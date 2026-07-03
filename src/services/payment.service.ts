import { Injectable, NotFoundException, BadRequestException, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InitiatePaymentDto, VerifyPaymentDto, PaymentProvider } from '../dto/payment.dto';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { NotificationService } from './notification.service';
import { ProviderRegistryService } from '../providers/provider-registry.service';
import { NyraWebhookService } from '../providers/nyra/nyra-webhook.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly usdtToNgnRate: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly providerRegistry: ProviderRegistryService,
    private readonly nyraWebhookService: NyraWebhookService,
    @Inject(forwardRef(() => NotificationService))
    private readonly notificationService: NotificationService,
  ) {
    this.usdtToNgnRate = this.configService.get<number>('USDT_EXCHANGE_RATE') || 1612;
  }

  private newPaymentReference(): string {
    return `pay${randomBytes(8).toString('hex')}`;
  }

  async initiatePayment(initiatePaymentDto: InitiatePaymentDto) {
    this.logger.debug(`Initiating payment for order: ${initiatePaymentDto.orderId}`);

    try {
      const order = await this.prisma.order.findUnique({
        where: { id: initiatePaymentDto.orderId },
        include: {
          payment: true,
          service: true,
          platform: true,
        },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (order.payment && order.payment.status === PaymentStatus.COMPLETED) {
        throw new BadRequestException('Payment already completed for this order');
      }

      const reference = this.newPaymentReference();
      const paymentMethod =
        initiatePaymentDto.provider === PaymentProvider.CRYPTO
          ? PaymentMethod.CRYPTO
          : PaymentMethod.NGN;

      const amountNgn = order.price;
      let cryptoAmount = null;
      let exchangeRate = null;

      if (paymentMethod === PaymentMethod.CRYPTO) {
        cryptoAmount = order.price / this.usdtToNgnRate;
        exchangeRate = this.usdtToNgnRate;
      }

      await this.prisma.payment.upsert({
        where: { orderId: order.id },
        update: {
          method: paymentMethod,
          status: PaymentStatus.PENDING,
          gatewayRef: reference,
          cryptoAmount,
          exchangeRate,
          updatedAt: new Date(),
        },
        create: {
          orderId: order.id,
          amount: order.price,
          currency: 'NGN',
          method: paymentMethod,
          status: PaymentStatus.PENDING,
          gatewayRef: reference,
          cryptoAmount,
          exchangeRate,
        },
      });

      if (initiatePaymentDto.provider === PaymentProvider.NYRA) {
        const fundingProvider = await this.providerRegistry.getFundingProvider();
        const virtualAccount = await fundingProvider.createFundingAccount({
          amount: Math.round(amountNgn),
          currency: 'NGN',
          reference,
          customerEmail: initiatePaymentDto.email || 'customer@boostlab.com',
          customerName: initiatePaymentDto.customerName,
          customerPhone: initiatePaymentDto.phone,
          nameOnAccount: initiatePaymentDto.customerName
            ? `${initiatePaymentDto.customerName} / BOOSTLAB`
            : undefined,
        });

        return {
          success: true,
          data: {
            reference,
            amount: amountNgn.toString(),
            currency: 'NGN',
            accountNumber: virtualAccount.accountNumber,
            bankName: virtualAccount.bankName,
            accountName: virtualAccount.accountName,
            bankCode: virtualAccount.bankCode,
            expiresAt: virtualAccount.expiresAt,
            providerAccountId: virtualAccount.providerAccountId,
            providerRail: virtualAccount.providerRail,
            instructions: [
              `Transfer exactly ₦${amountNgn.toLocaleString()} to the account details above`,
              'Use the exact amount — any difference may prevent automatic confirmation',
              'Payment will be confirmed automatically once received',
              'Account expires at the time shown above',
            ],
            orderDetails: {
              orderId: order.id,
              platform: order.platform.name,
              service: order.service.name,
              quantity: order.quantity,
            },
          },
        };
      }

      return {
        success: true,
        data: {
          reference,
          amount: cryptoAmount!.toFixed(6),
          currency: 'USDT',
          network: 'TRC20',
          walletAddress: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE',
          exchangeRate: this.usdtToNgnRate,
          exchangeInfo: `1 USDT = ₦${this.usdtToNgnRate}`,
          qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE`,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          instructions: [
            `Send exactly ${cryptoAmount!.toFixed(6)} USDT to the wallet address above`,
            'IMPORTANT: Use TRC20 network only (Tron)',
            'Screenshot your transaction hash',
            'Payment will be confirmed automatically once blockchain confirms',
          ],
          orderDetails: {
            orderId: order.id,
            platform: order.platform.name,
            service: order.service.name,
            quantity: order.quantity,
          },
        },
      };
    } catch (error) {
      this.logger.error(`Failed to initiate payment: ${error.message}`, error.stack);
      throw error;
    }
  }

  async verifyPayment(verifyPaymentDto: VerifyPaymentDto) {
    this.logger.debug(`Verifying payment: ${verifyPaymentDto.reference}`);

    try {
      const payment = await this.prisma.payment.findFirst({
        where: { gatewayRef: verifyPaymentDto.reference },
        include: {
          order: { include: { service: true, platform: true } },
          transactions: true,
        },
      });

      if (!payment) {
        throw new NotFoundException('Payment record not found');
      }

      const paymentProvider =
        verifyPaymentDto.provider ||
        (payment.method === PaymentMethod.CRYPTO ? PaymentProvider.CRYPTO : PaymentProvider.NYRA);

      let verificationResult: Record<string, unknown>;

      if (paymentProvider === PaymentProvider.NYRA) {
        const completedTx = payment.transactions.find((t) => t.status === 'COMPLETED');
        if (completedTx || payment.status === PaymentStatus.COMPLETED) {
          const tx = completedTx || payment.transactions[0];
          verificationResult = {
            status: 'success',
            reference: verifyPaymentDto.reference,
            amount: tx?.amount.toNumber() ?? payment.amount.toNumber(),
            currency: payment.currency,
            paid_at: tx?.paidAt?.toISOString() || new Date().toISOString(),
            orderId: payment.orderId,
            verificationMethod: 'existing_transaction',
          };
        } else {
          const webhookLog = await this.prisma.webhookLog.findFirst({
            where: {
              provider: 'nyra',
              processed: true,
              processingError: null,
              paymentId: payment.id,
            },
            orderBy: { createdAt: 'desc' },
          });

          if (webhookLog) {
            const data = (webhookLog.payload as any)?.data;
            verificationResult = {
              status: 'success',
              reference: verifyPaymentDto.reference,
              amount: data?.amount_received ?? payment.amount.toNumber(),
              currency: data?.currency || payment.currency,
              paid_at: data?.paid_at || webhookLog.createdAt.toISOString(),
              orderId: payment.orderId,
              verificationMethod: 'webhook_log',
            };
          } else {
            verificationResult = {
              status: 'pending',
              reference: verifyPaymentDto.reference,
              amount: 0,
              currency: payment.currency,
              orderId: payment.orderId,
              error: 'Payment not yet received — transfer the exact amount to the provided account',
              verificationMethod: 'awaiting_webhook',
            };
          }
        }
      } else {
        verificationResult = {
          status: 'success',
          reference: verifyPaymentDto.reference,
          amount: payment.amount.toNumber(),
          currency: payment.currency,
          paid_at: new Date().toISOString(),
          orderId: payment.orderId,
          verificationMethod: 'crypto_auto',
        };
      }

      if (verificationResult.status === 'success' && payment.status !== PaymentStatus.COMPLETED) {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.COMPLETED, updatedAt: new Date() },
        });
      } else if (verificationResult.status === 'failed') {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.FAILED, updatedAt: new Date() },
        });
      }

      return { success: true, data: verificationResult };
    } catch (error) {
      this.logger.error(`Payment verification failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getPaymentStatus(orderId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
      include: { order: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return {
      orderId: payment.orderId,
      status: payment.status.toLowerCase(),
      amount: payment.amount.toString(),
      currency: payment.currency,
      method: payment.method.toLowerCase(),
      gatewayRef: payment.gatewayRef,
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
    };
  }

  async handleNyraWebhook(payload: any, headers?: any, ipAddress?: string) {
    return this.nyraWebhookService.handleWebhook(payload, headers, ipAddress);
  }
}
