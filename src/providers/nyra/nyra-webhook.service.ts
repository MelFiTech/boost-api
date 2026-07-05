import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import {
  TransactionStatus,
  WalletTransactionCategory,
  WalletTransactionType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderFulfillmentService } from '../../smmstone/order-fulfillment.service';
import { NotificationService } from '../../services/notification.service';
import { WalletService } from '../../wallet/wallet.service';
import { NyraApiService } from './nyra-api.service';
import { NyraElectricityCompletedPayload } from './nyra-vas.types';
import { NyraTransferWebhookPayload, NyraWebhookPayload } from './nyra.types';

/**
 * Handles Nyra webhooks:
 *   managed_wallet.temporary_account_funded → wallet / order funding
 *   managed_wallet.transfer → withdrawal transfer status
 *   vas.electricity.completed → electricity token delivery
 */
@Injectable()
export class NyraWebhookService {
  private readonly logger = new Logger(NyraWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nyraApi: NyraApiService,
    private readonly walletService: WalletService,
    private readonly notificationService: NotificationService,
    private readonly orderFulfillment: OrderFulfillmentService,
  ) {}

  async handleWebhook(
    payload: NyraWebhookPayload | { event: string; data: Record<string, unknown> },
    headers?: Record<string, string>,
    ipAddress?: string,
  ) {
    const signature = headers?.['x-nyra-signature'] || headers?.['X-Nyra-Signature'];

    if (!this.nyraApi.verifyWebhookSignature(payload, signature)) {
      throw new UnauthorizedException('Invalid Nyra webhook signature');
    }

    const log = await this.prisma.webhookLog.create({
      data: {
        provider: 'nyra',
        event: payload?.event || 'unknown',
        payload: (payload ?? {}) as object,
        headers: headers || {},
        processed: false,
        ipAddress,
      },
    });

    try {
      switch (payload.event) {
        case 'managed_wallet.temporary_account_funded':
          return this.handleFundingWebhook(log.id, payload as NyraWebhookPayload);
        case 'managed_wallet.transfer':
          return this.handleTransferWebhook(log.id, payload.data as NyraTransferWebhookPayload);
        case 'vas.electricity.completed':
          return this.handleElectricityCompleted(log.id, payload.data as NyraElectricityCompletedPayload);
        default:
          await this.markLog(log.id, { processed: true, error: `Unhandled event: ${payload.event}` });
          return { success: true, message: 'Ignored: unhandled event' };
      }
    } catch (error) {
      this.logger.error(`Nyra webhook failed: ${error.message}`, error.stack);
      await this.markLog(log.id, { processed: true, error: error.message });
      return { success: false, message: 'Webhook processing failed' };
    }
  }

  private async handleTransferWebhook(logId: string, data: NyraTransferWebhookPayload) {
    const reference =
      (data.client_request_id as string) ||
      data.reference ||
      data.sessionId ||
      data.transaction_id;

    if (!reference) {
      await this.markLog(logId, { processed: true, error: 'Missing transfer reference' });
      return { success: false, message: 'Missing transfer reference' };
    }

    const withdrawal = await this.prisma.walletTransaction.findFirst({
      where: {
        OR: [
          { reference },
          { providerRef: data.transaction_id || data.sessionId || undefined },
        ],
        category: WalletTransactionCategory.WITHDRAWAL,
      },
      include: { wallet: true },
    });

    if (!withdrawal) {
      await this.markLog(logId, { processed: true, error: `No withdrawal for ${reference}` });
      return { success: true, message: 'No matching withdrawal transaction' };
    }

    const status = data.status?.toLowerCase();
    const isSuccess = status === 'successful' || status === 'success';
    const isFailed = status === 'failed' || status === 'failure';

    if (isSuccess) {
      await this.prisma.walletTransaction.update({
        where: { id: withdrawal.id },
        data: {
          status: TransactionStatus.COMPLETED,
          providerRef: data.transaction_id || withdrawal.providerRef,
          metadata: {
            ...((withdrawal.metadata as object) || {}),
            nyraWebhook: data as object,
          },
        },
      });
      await this.markLog(logId, { processed: true, transactionId: withdrawal.id });
      return { success: true, message: 'Withdrawal transfer completed' };
    }

    if (isFailed && withdrawal.status !== TransactionStatus.REFUNDED) {
      const userId = withdrawal.wallet.userId;
      const amount = withdrawal.amount.toNumber();
      await this.walletService.refundWithdrawal(
        userId,
        amount,
        withdrawal.id,
        data.narration || 'Nyra transfer failed',
      );
      await this.markLog(logId, {
        processed: true,
        transactionId: withdrawal.id,
        error: 'Withdrawal failed — refunded',
      });
      return { success: true, message: 'Withdrawal failed and refunded' };
    }

    await this.markLog(logId, { processed: true, transactionId: withdrawal.id });
    return { success: true, message: 'Transfer webhook recorded' };
  }

  private async handleFundingWebhook(logId: string, payload: NyraWebhookPayload) {
    const data = payload.data;
    const externalRef = data.external_reference;
    const isSuccess = data.status === 'successful';

    if (!externalRef) {
      await this.markLog(logId, { processed: true, error: 'Missing external_reference' });
      return { success: false, message: 'Missing external_reference' };
    }

    if (!isSuccess) {
      await this.markLog(logId, { processed: true, error: `Non-success status: ${data.status}` });
      return { success: true, message: 'Ignored: non-successful payment' };
    }

    if (externalRef.startsWith('wf')) {
      return this.handleWalletFunding(logId, data, externalRef);
    }

    if (externalRef.startsWith('pay')) {
      return this.handleOrderPayment(logId, data, externalRef);
    }

    await this.markLog(logId, { processed: true, error: 'Unknown reference prefix' });
    return { success: true, message: 'Ignored: unknown reference prefix' };
  }

  private async handleElectricityCompleted(
    logId: string,
    data: NyraElectricityCompletedPayload,
  ) {
    const txnId = data.transaction_id;
    if (!txnId) {
      await this.markLog(logId, { processed: true, error: 'Missing transaction_id' });
      return { success: false, message: 'Missing transaction_id' };
    }

    const bill = await this.prisma.billPayment.findFirst({
      where: {
        billType: 'ELECTRICITY',
        OR: [
          { providerRef: txnId },
          ...(data.reference ? [{ providerRef: data.reference }] : []),
        ],
      },
    });

    if (!bill) {
      await this.markLog(logId, { processed: true, error: `No electricity bill for ${txnId}` });
      return { success: true, message: 'No matching electricity bill payment' };
    }

    const isDelivered = data.status?.toLowerCase() === 'delivered';
    const existingMeta = (bill.metadata as { token?: string; billerName?: string } | null) || {};

    if (isDelivered) {
      if (existingMeta.token) {
        await this.markLog(logId, { processed: true });
        return { success: true, message: 'Electricity token already delivered' };
      }

      await this.prisma.billPayment.update({
        where: { id: bill.id },
        data: {
          status: TransactionStatus.COMPLETED,
          metadata: {
            ...existingMeta,
            token: data.token,
            number_of_units: data.number_of_units,
            provider: data.provider,
            webhook: data as object,
          },
        },
      });

      if (data.token) {
        void this.notificationService
          .notifyElectricityTokenDelivered(bill.userId, {
            billPaymentId: bill.id,
            token: data.token,
            meterNumber: data.meter_number || bill.customerIdentifier,
            amount: data.amount ?? bill.amount.toNumber(),
            reference: data.transaction_id || txnId,
            numberOfUnits: data.number_of_units,
            providerName: data.provider || existingMeta.billerName,
          })
          .catch((err) =>
            this.logger.warn(`Electricity token notify failed: ${err.message}`),
          );
      }

      await this.markLog(logId, { processed: true });
      return { success: true, message: 'Electricity token delivered' };
    }

    await this.prisma.billPayment.update({
      where: { id: bill.id },
      data: {
        status: TransactionStatus.FAILED,
        metadata: { ...(bill.metadata as object), webhook: data as object },
      },
    });

    const amount = bill.amount.toNumber();
    await this.walletService.applyLedgerEntry({
      userId: bill.userId,
      type: WalletTransactionType.CREDIT,
      category: WalletTransactionCategory.REFUND,
      amount,
      narration: 'Refund for failed electricity vending',
      provider: bill.provider,
      referencePrefix: 'rfd',
      metadata: { billPaymentId: bill.id },
    });

    await this.prisma.billPayment.update({
      where: { id: bill.id },
      data: { status: TransactionStatus.REFUNDED },
    });

    await this.markLog(logId, { processed: true, error: 'Electricity vending failed — refunded' });
    return { success: true, message: 'Electricity failed and refunded' };
  }

  private async handleWalletFunding(
    logId: string,
    data: NyraWebhookPayload['data'],
    externalRef: string,
  ) {
    const paidAmount = data.amount_settled ?? data.amount_received;
    const tx = await this.walletService.confirmFunding(
      externalRef,
      data.reference || data.sessionId || externalRef,
      paidAmount,
    );

    await this.markLog(logId, { processed: true, transactionId: tx.id });
    return { success: true, message: 'Wallet funded' };
  }

  private async handleOrderPayment(
    logId: string,
    data: NyraWebhookPayload['data'],
    externalRef: string,
  ) {
    const payment = await this.prisma.payment.findFirst({
      where: { gatewayRef: externalRef, status: 'PENDING' },
      include: {
        order: { include: { service: true, platform: true } },
      },
    });

    if (!payment) {
      await this.markLog(logId, { processed: true, error: `No pending payment for ${externalRef}` });
      return { success: true, message: 'No matching pending payment' };
    }

    const providerRef = data.reference || data.sessionId || externalRef;
    const existingTransaction = await this.prisma.transaction.findFirst({
      where: { budpayReference: providerRef },
    });

    if (existingTransaction) {
      await this.markLog(logId, {
        processed: true,
        paymentId: payment.id,
        orderId: payment.orderId,
        transactionId: existingTransaction.id,
      });
      return { success: true, message: 'Payment already recorded' };
    }

    const amount = data.amount_received ?? data.amount_settled ?? payment.amount.toNumber();

    const transaction = await this.prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          paymentId: payment.id,
          budpayReference: providerRef,
          ourReference: externalRef,
          amount,
          currency: data.currency || payment.currency,
          status: 'COMPLETED',
          budpayStatus: data.status,
          accountNumber: data.credit_account_number,
          customerEmail:
            (data.meta?.customer_email as string) ||
            payment.customerEmail ||
            undefined,
          narration: data.sender_name ? `Transfer from ${data.sender_name}` : undefined,
          sessionId: data.sessionId,
          paidAt: data.paid_at ? new Date(data.paid_at) : new Date(),
          webhookReceived: true,
          webhookData: data as object,
        },
      });

      await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'COMPLETED', updatedAt: new Date() },
      });

      return created;
    });

    this.logger.log(`Order payment completed via Nyra: ${payment.id} order=${payment.orderId}`);

    // Hand off to SMMStone immediately; failure keeps the order on the
    // admin attention list without affecting the recorded payment
    try {
      await this.orderFulfillment.fulfillOrder(payment.orderId);
    } catch (err) {
      this.logger.error(`Auto-fulfillment after Nyra payment failed: ${err.message}`);
    }

    try {
      await this.notificationService.sendOrderNotification(payment.orderId, 'payment_received');
    } catch (err) {
      this.logger.warn(`Payment receipt notification failed: ${err.message}`);
    }

    await this.markLog(logId, {
      processed: true,
      paymentId: payment.id,
      orderId: payment.orderId,
      transactionId: transaction.id,
    });

    return { success: true, message: 'Order payment confirmed' };
  }

  private async markLog(
    id: string,
    opts: {
      processed: boolean;
      error?: string;
      paymentId?: string;
      orderId?: string;
      transactionId?: string;
    },
  ) {
    await this.prisma.webhookLog.update({
      where: { id },
      data: {
        processed: opts.processed,
        processingError: opts.error,
        paymentId: opts.paymentId,
        orderId: opts.orderId,
        transactionId: opts.transactionId,
      },
    });
  }
}
