import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PaymentStatus, WalletTransactionCategory, WalletTransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LOW_PROVIDER_BALANCE_ISSUE } from '../smmstone/smmstone-balance.util';
import { OrderFulfillmentService } from '../smmstone/order-fulfillment.service';
import { WalletService } from '../wallet/wallet.service';
import { ResendService } from './resend.service';

/**
 * Admin recovery tooling for the hands-off fulfillment flow. Orders go to
 * SMMStone automatically on payment; the admin only deals with the ones
 * that got stuck (paid but not submitted) or failed at the provider.
 */
@Injectable()
export class AdminOrdersService {
  private readonly logger = new Logger(AdminOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderFulfillment: OrderFulfillmentService,
    private readonly walletService: WalletService,
    private readonly resendService: ResendService,
  ) {}

  /** Paid-but-unsubmitted, failed, or cancelled orders that may need action */
  async getOrdersNeedingAttention() {
    const orders = await this.prisma.order.findMany({
      where: {
        OR: [
          // Paid but never reached the provider (auto-fulfillment failed)
          {
            status: 'PENDING',
            providerOrderId: null,
            payment: { status: PaymentStatus.COMPLETED },
          },
          // Provider reported failure/cancellation
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

    // Allow refiring failed/cancelled orders by clearing the old provider ref
    if (order.providerOrderId && ['FAILED', 'CANCELLED'].includes(order.status)) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { providerOrderId: null, status: 'PENDING' },
      });
    }

    const result = await this.orderFulfillment.fulfillOrder(orderId);
    if (!result.submitted) {
      throw new BadRequestException(`Provider rejected the order: ${result.error}`);
    }
    return result;
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
        user: { select: { email: true } },
        platform: true,
        payment: { include: { transactions: { orderBy: { createdAt: 'desc' }, take: 1 } } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    // Priority: explicit email → account email → email captured at payment
    const to =
      email || order.user?.email || order.payment?.transactions[0]?.customerEmail || null;
    if (!to) {
      throw new BadRequestException('No email on record for this order — provide one explicitly');
    }

    const subject = `Update on your BoostLab order`;
    const body =
      message ||
      `Hi,\n\nWe're reaching out about your ${order.platform.name} order (${order.quantity.toLocaleString()} units). Our team is looking into it and will make sure it's resolved.\n\nIf you have any questions, just reply to this email.\n\n— BoostLab`;

    const result = await this.resendService.sendCustomEmail(
      to,
      subject,
      body.replace(/\n/g, '<br/>'),
    );
    if (!result.success) {
      throw new BadRequestException(`Email failed to send: ${result.error}`);
    }
    this.logger.log(`Order ${orderId} notification sent to ${to}`);
    return { sent: true, to };
  }
}
