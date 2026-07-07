import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OrderStatus, PaymentStatus, WalletTransactionCategory, WalletTransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LOW_PROVIDER_BALANCE_ISSUE } from '../smmstone/smmstone-balance.util';
import { OrderFulfillmentService } from '../smm/order-fulfillment.service';
import { SmmOrderStatusService } from '../smm/smm-order-status.service';
import { WalletService } from '../wallet/wallet.service';
import { EmailService } from '../emails/email.service';

type AdminSubmitResult = {
  submitted: boolean;
  alreadySubmitted?: boolean;
  providerOrderId?: string;
  status?: string;
  providerStatus?: string | null;
  settled?: boolean;
  stillProcessing?: boolean;
  polls?: number;
  error?: string;
  issue?: string;
};

/**
 * Admin recovery tooling for the hands-off fulfillment flow. Orders go to
 * the active SMM provider automatically on payment; admin handles stuck orders.
 */
@Injectable()
export class AdminOrdersService {
  private readonly logger = new Logger(AdminOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderFulfillment: OrderFulfillmentService,
    private readonly orderStatus: SmmOrderStatusService,
    private readonly walletService: WalletService,
    private readonly emailService: EmailService,
  ) {}

  private ordersMissingProviderWhere() {
    return {
      providerOrderId: null,
      status: { in: [OrderStatus.PENDING, OrderStatus.COMPLETED] as OrderStatus[] },
      payment: { status: PaymentStatus.COMPLETED },
    };
  }

  /** Paid-but-unsubmitted, failed, or cancelled orders that may need action */
  async getOrdersNeedingAttention() {
    const orders = await this.prisma.order.findMany({
      where: {
        OR: [
          this.ordersMissingProviderWhere(),
          { status: { in: ['FAILED', 'CANCELLED'] } },
        ],
      },
      include: {
        user: { select: { id: true, email: true } },
        platform: { select: { name: true } },
        service: { select: { name: true } },
        payment: { select: { status: true, amount: true, gatewayRef: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    return orders.map((order) => {
      const lowBalanceQueued =
        order.fulfillmentError?.includes(LOW_PROVIDER_BALANCE_ISSUE) ?? false;
      let issue = !order.providerOrderId ? 'NOT_SUBMITTED' : order.status;
      if (order.status === 'COMPLETED' && !order.providerOrderId) {
        issue = 'NOT_SUBMITTED';
      }
      if (lowBalanceQueued) issue = LOW_PROVIDER_BALANCE_ISSUE;

      return {
        id: order.id,
        status: order.status,
        platform: order.platform.name,
        service: order.service.name,
        quantity: order.quantity,
        link: order.link,
        price: order.price,
        providerOrderId: order.providerOrderId,
        fulfillmentError: order.fulfillmentError,
        paymentStatus: order.payment?.status ?? 'NONE',
        isGuest: !order.userId,
        userEmail: order.user?.email ?? null,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        issue,
      };
    });
  }

  /**
   * Approve (mark paid if needed), submit to provider, set PROCESSING, poll until settled.
   */
  async approveAndFulfillOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
      throw new BadRequestException(`Cannot fulfill a ${order.status.toLowerCase()} order`);
    }
    if (order.status === 'COMPLETED' && order.providerOrderId) {
      throw new BadRequestException('Order is already completed with the provider');
    }

    if (order.payment && order.payment.status !== PaymentStatus.COMPLETED) {
      await this.prisma.payment.update({
        where: { id: order.payment.id },
        data: { status: PaymentStatus.COMPLETED, updatedAt: new Date() },
      });
    }

    return this.submitToProviderAndPoll(orderId, { poll: true });
  }

  /** Re-submit a stuck or failed order to the provider */
  async refireOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.payment?.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException('Order has no completed payment');
    }
    if (order.status === 'REFUNDED') {
      throw new BadRequestException('Order was already refunded');
    }

    if (
      order.providerOrderId &&
      !['FAILED', 'CANCELLED'].includes(order.status) &&
      order.status !== 'COMPLETED'
    ) {
      const poll = await this.orderStatus.pollOrderUntilSettled(orderId);
      return {
        alreadySubmitted: true,
        providerOrderId: order.providerOrderId,
        ...poll,
      };
    }

    if (order.providerOrderId && ['FAILED', 'CANCELLED'].includes(order.status)) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { providerOrderId: null, status: 'PENDING', fulfillmentError: null },
      });
    }

    const result = await this.submitToProviderAndPoll(orderId, { poll: true });
    if (!result.submitted && !result.alreadySubmitted) {
      throw new BadRequestException(`Provider rejected the order: ${result.error}`);
    }
    return result;
  }

  /** Submit every paid order missing a provider reference (pending or wrongly completed). */
  async submitOrdersMissingProvider() {
    const orders = await this.prisma.order.findMany({
      where: this.ordersMissingProviderWhere(),
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    const results: Array<{
      orderId: string;
      submitted: boolean;
      providerOrderId?: string;
      status?: string;
      error?: string;
      issue?: string;
    }> = [];

    for (const order of orders) {
      try {
        const result = await this.submitToProviderAndPoll(order.id, {
          poll: false,
          syncOnce: true,
        });
        results.push({
          orderId: order.id,
          submitted: !!result.submitted,
          providerOrderId: result.providerOrderId,
          status: result.status,
          error: result.error,
          issue: result.issue,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({ orderId: order.id, submitted: false, error: message });
      }
    }

    const submitted = results.filter((r) => r.submitted).length;
    const failed = results.length - submitted;

    this.logger.log(
      `Bulk provider submit: ${submitted}/${results.length} orders submitted`,
    );

    return { attempted: results.length, submitted, failed, results };
  }

  /** @deprecated Use submitOrdersMissingProvider */
  async refireAllPendingOrders() {
    return this.submitOrdersMissingProvider();
  }

  private async submitToProviderAndPoll(
    orderId: string,
    options: { poll?: boolean; syncOnce?: boolean } = {},
  ): Promise<AdminSubmitResult> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });
    if (!order) {
      return { submitted: false, error: 'Order not found' };
    }

    if (order.providerOrderId) {
      const poll = options.poll
        ? await this.orderStatus.pollOrderUntilSettled(orderId)
        : options.syncOnce
          ? await this.orderStatus.syncOrderStatus(orderId)
          : { status: order.status };
      return {
        alreadySubmitted: true,
        providerOrderId: order.providerOrderId,
        submitted: true,
        status: poll.status,
        providerStatus: 'providerStatus' in poll ? poll.providerStatus : undefined,
      };
    }

    if (order.status === 'COMPLETED') {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'PENDING', fulfillmentError: null },
      });
    } else {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { fulfillmentError: null },
      });
    }

    const fulfillment = await this.orderFulfillment.fulfillOrder(orderId);
    if (!fulfillment.submitted) {
      return fulfillment;
    }

    if (options.poll) {
      const poll = await this.orderStatus.pollOrderUntilSettled(orderId);
      return {
        submitted: true,
        providerOrderId: fulfillment.providerOrderId,
        status: poll.status,
        providerStatus: poll.providerStatus,
        settled: poll.settled,
        stillProcessing: poll.stillProcessing,
        polls: poll.polls,
      };
    }

    if (options.syncOnce) {
      const sync = await this.orderStatus.syncOrderStatus(orderId);
      return {
        submitted: true,
        providerOrderId: fulfillment.providerOrderId,
        status: sync.status,
        providerStatus: sync.providerStatus,
      };
    }

    const updated = await this.prisma.order.findUnique({ where: { id: orderId } });
    return {
      submitted: true,
      providerOrderId: fulfillment.providerOrderId,
      status: updated?.status ?? 'PROCESSING',
    };
  }

  /** Reverse an order payment back into the user's wallet */
  async refundOrderToWallet(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true, platform: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (!order.userId) {
      throw new BadRequestException(
        'Guest order — there is no wallet to refund. Use the notify endpoint instead.',
      );
    }
    if (order.payment?.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException('Order has no completed payment to refund');
    }
    if (order.status === 'REFUNDED') {
      throw new BadRequestException('Order was already refunded');
    }

    const credit = await this.walletService.applyLedgerEntry({
      userId: order.userId,
      type: WalletTransactionType.CREDIT,
      category: WalletTransactionCategory.REFUND,
      amount: order.price,
      narration: `Refund for ${order.platform.name} order`,
      referencePrefix: 'rfd',
      metadata: { orderId: order.id },
    });

    await this.prisma.$transaction([
      this.prisma.order.update({ where: { id: orderId }, data: { status: 'REFUNDED' } }),
      this.prisma.payment.update({
        where: { orderId },
        data: { status: PaymentStatus.CANCELLED },
      }),
    ]);

    this.logger.log(`Order ${orderId} refunded to wallet (${credit.reference})`);
    return { refunded: true, reference: credit.reference, amount: order.price };
  }

  /** Email a customer about their order — mainly for guest orders */
  async notifyCustomer(orderId: string, email?: string, message?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { id: true, email: true } },
        platform: true,
        payment: { include: { transactions: { orderBy: { createdAt: 'desc' }, take: 1 } } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    const to =
      email || order.user?.email || order.payment?.customerEmail || order.payment?.transactions[0]?.customerEmail || null;
    if (!to) {
      throw new BadRequestException('No email on record for this order — provide one explicitly');
    }

    const subject = `Update on your BoostLab order`;
    const body =
      message ||
      `Hi,\n\nWe're reaching out about your ${order.platform.name} order (${order.quantity.toLocaleString()} units). Our team is looking into it and will make sure it's resolved.\n\nIf you have any questions, just reply to this email.\n\n— BoostLab`;

    const result = await this.emailService.sendCustomEmail(
      to,
      subject,
      body.replace(/\n/g, '<br/>'),
      { isHtml: false, userId: order.user?.id },
    );
    if (result.skipped) {
      throw new BadRequestException('User has email notifications turned off');
    }
    if (!result.success) {
      throw new BadRequestException(`Email failed to send: ${result.error}`);
    }
    this.logger.log(`Order ${orderId} notification sent to ${to}`);
    return { sent: true, to };
  }
}
