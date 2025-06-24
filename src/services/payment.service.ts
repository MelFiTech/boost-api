import { Injectable, NotFoundException, BadRequestException, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InitiatePaymentDto, VerifyPaymentDto, PaymentProvider } from '../dto/payment.dto';
import { PaymentMethod, PaymentStatus, OrderStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { BudPayService } from './budpay.service';
import { NotificationService } from './notification.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly usdtToNgnRate: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly budPayService: BudPayService,
    @Inject(forwardRef(() => NotificationService))
    private readonly notificationService: NotificationService
  ) {
    this.usdtToNgnRate = this.configService.get<number>('USDT_EXCHANGE_RATE') || 1612;
  }

  async initiatePayment(initiatePaymentDto: InitiatePaymentDto) {
    this.logger.debug(`Initiating payment for order: ${initiatePaymentDto.orderId}`);

    try {
      // Find the order
      const order = await this.prisma.order.findUnique({
        where: { id: initiatePaymentDto.orderId },
        include: {
          payment: true,
          service: true,
          platform: true
        }
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      // Check if payment already exists and is completed
      if (order.payment && order.payment.status === PaymentStatus.COMPLETED) {
        throw new BadRequestException('Payment already completed for this order');
      }

      // Generate payment reference
      const reference = `boost_${order.id}_${Date.now()}`;
      
      // Determine payment method and amount
      const paymentMethod = initiatePaymentDto.provider === PaymentProvider.CRYPTO 
        ? PaymentMethod.CRYPTO 
        : PaymentMethod.NGN;

      let amount = order.price;
      let cryptoAmount = null;
      let exchangeRate = null;

      if (paymentMethod === PaymentMethod.CRYPTO) {
        // Convert NGN price to USDT
        cryptoAmount = order.price / this.usdtToNgnRate;
        exchangeRate = this.usdtToNgnRate;
      }

      // Create or update payment record
      const payment = await this.prisma.payment.upsert({
        where: { orderId: order.id },
        update: {
          method: paymentMethod,
          status: PaymentStatus.PENDING,
          gatewayRef: reference,
          cryptoAmount: cryptoAmount,
          exchangeRate: exchangeRate,
          updatedAt: new Date()
        },
        create: {
          orderId: order.id,
          amount: amount,
          currency: 'NGN',
          method: paymentMethod,
          status: PaymentStatus.PENDING,
          gatewayRef: reference,
          cryptoAmount: cryptoAmount,
          exchangeRate: exchangeRate
        }
      });

      // Return payment details based on provider
      if (initiatePaymentDto.provider === PaymentProvider.BUDPAY) {
        // Create virtual account using BudPay API with generated abstract name
        const virtualAccount = await this.budPayService.createVirtualAccount(
          amount,
          'NGN',
          reference,
          initiatePaymentDto.email || 'customer@boostlab.com'
        );

        return {
          success: true,
          data: {
            reference: reference,
            amount: amount.toString(),
            currency: 'NGN',
            // Dynamic account details from BudPay API
            accountNumber: virtualAccount.accountNumber,
            bankName: virtualAccount.bankName,
            accountName: virtualAccount.accountName,
            bankCode: virtualAccount.bankCode,
            expiresAt: virtualAccount.expiresAt,
            instructions: [
              `Transfer exactly ₦${amount.toLocaleString()} to the account details above`,
              'Use the exact amount - any difference will cause payment failure',
              'Include your order ID in the transaction narration',
              'Payment will be confirmed automatically within 5 minutes',
              'Contact support if payment is not confirmed after 15 minutes'
            ],
            // Additional details for verification
            orderDetails: {
              orderId: order.id,
              platform: order.platform.name,
              service: order.service.name,
              quantity: order.quantity
            }
          }
        };
      } else {
        // Crypto payment - USDT TRC20
        return {
          success: true,
          data: {
            reference: reference,
            amount: cryptoAmount.toFixed(6),
            currency: 'USDT',
            network: 'TRC20',
            walletAddress: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE', // Replace with your actual TRC20 wallet
            exchangeRate: this.usdtToNgnRate,
            exchangeInfo: `1 USDT = ₦${this.usdtToNgnRate}`,
            qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE`,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
            instructions: [
              `Send exactly ${cryptoAmount.toFixed(6)} USDT to the wallet address above`,
              'IMPORTANT: Use TRC20 network only (Tron)',
              'Do not use any other network (BEP20, ERC20, etc.)',
              'Screenshot your transaction hash',
              'Payment will be confirmed automatically once blockchain confirms',
              'Confirmation usually takes 1-3 minutes'
            ],
            orderDetails: {
              orderId: order.id,
              platform: order.platform.name,
              service: order.service.name,
              quantity: order.quantity
            }
          }
        };
      }

    } catch (error) {
      this.logger.error(`Failed to initiate payment: ${error.message}`, error.stack);
      throw error;
    }
  }

  async verifyPayment(verifyPaymentDto: VerifyPaymentDto) {
    this.logger.debug(`Verifying payment: ${verifyPaymentDto.reference}`);

    try {
      // Find payment by gateway reference
      const payment = await this.prisma.payment.findFirst({
        where: { gatewayRef: verifyPaymentDto.reference },
        include: {
          order: {
            include: {
              service: true,
              platform: true
            }
          }
        }
      });

      if (!payment) {
        throw new NotFoundException('Payment record not found');
      }

      // Determine payment provider - use provided value or infer from payment method
      const paymentProvider = verifyPaymentDto.provider || 
        (payment.method === PaymentMethod.CRYPTO ? PaymentProvider.CRYPTO : PaymentProvider.BUDPAY);

      this.logger.debug(`Using payment provider: ${paymentProvider} for verification`);

      let verificationResult;

      if (paymentProvider === PaymentProvider.BUDPAY) {
        // PRIMARY: Check webhook logs for successful payment
        // Extract account number from gateway reference (remove boost_ prefix)
        const accountNumber = payment.gatewayRef.replace('boost_', '');
        
        const successfulWebhookLog = await this.prisma.webhookLog.findFirst({
          where: {
            provider: 'budpay',
            processed: true,
            processingError: null,
            OR: [
              { event: 'successful' },
              { event: 'payment.successful' }
            ]
          },
          orderBy: { createdAt: 'desc' }
        });

        let matchingWebhook = null;
        if (successfulWebhookLog) {
          const webhookPayload = successfulWebhookLog.payload as any;
          const webhookData = webhookPayload.data;
          
          // Check if account number and amount match
          const expectedAmount = payment.amount.toNumber();
          const webhookAmount = parseFloat(webhookData?.amount?.toString() || '0');
          const webhookAccountNumber = webhookData?.account_number;
          
          if (webhookAccountNumber === accountNumber && Math.abs(webhookAmount - expectedAmount) < 1) {
            matchingWebhook = { webhookLog: successfulWebhookLog, webhookData };
          }
        }

        if (matchingWebhook) {
          const { webhookLog, webhookData } = matchingWebhook;
          
          this.logger.log(`Payment verified via webhook log: ${webhookLog.id} - Account: ${webhookData.account_number}, Amount: ${webhookData.amount}`);
          
          verificationResult = {
            status: 'success',
            reference: webhookData.reference || payment.gatewayRef,
            amount: parseFloat(webhookData.amount?.toString() || '0'),
            currency: webhookData.currency || payment.currency,
            paid_at: webhookData.paid_at || webhookLog.createdAt.toISOString(),
            orderId: payment.orderId,
            webhookLogId: webhookLog.id,
            accountNumber: webhookData.account_number,
            bankName: webhookData.bank_name,
            verificationMethod: 'webhook_log'
          };
        } else {
          // FALLBACK: Check existing transaction records
          const existingTransaction = await this.prisma.transaction.findFirst({
            where: {
              paymentId: payment.id,
              status: 'COMPLETED'
            }
          });

          if (existingTransaction) {
            verificationResult = {
              status: 'success',
              reference: existingTransaction.budpayReference,
              amount: existingTransaction.amount.toNumber(),
              currency: existingTransaction.currency,
              paid_at: existingTransaction.paidAt?.toISOString() || new Date().toISOString(),
              orderId: payment.orderId,
              verificationMethod: 'existing_transaction'
            };

            this.logger.log(`Payment verified via existing transaction: ${existingTransaction.budpayReference}`);
          } else {
            // LAST RESORT: Check BudPay API directly
            const budpayTransactions = await this.budPayService.checkVirtualAccountTransactions(payment.gatewayRef);
            
            if (budpayTransactions.length > 0) {
              const expectedAmount = payment.amount.toNumber();
              const matchingTransaction = budpayTransactions.find(tx => 
                tx.status === 'success' && 
                Math.abs(parseFloat(tx.amount.toString()) - expectedAmount) < 1
              );

              if (matchingTransaction) {
                verificationResult = {
                  status: 'success',
                  reference: matchingTransaction.reference,
                  amount: matchingTransaction.amount,
                  currency: matchingTransaction.currency || payment.currency,
                  paid_at: matchingTransaction.paidAt || new Date().toISOString(),
                  orderId: payment.orderId,
                  verificationMethod: 'api_check'
                };

                this.logger.log(`Payment verified via API check: ${matchingTransaction.reference}`);
              } else {
                verificationResult = {
                  status: 'failed',
                  reference: verifyPaymentDto.reference,
                  amount: 0,
                  currency: payment.currency,
                  orderId: payment.orderId,
                  error: 'Payment amount does not match any completed transactions',
                  verificationMethod: 'api_check_failed'
                };

                this.logger.warn(`Payment amount mismatch for ${verifyPaymentDto.reference}. Expected: ${expectedAmount}, Found transactions:`, budpayTransactions);
              }
            } else {
              verificationResult = {
                status: 'pending',
                reference: verifyPaymentDto.reference,
                amount: 0,
                currency: payment.currency,
                orderId: payment.orderId,
                error: 'No payment found in webhook logs, transactions, or API',
                verificationMethod: 'not_found'
              };

              this.logger.warn(`No payment verification found for: ${verifyPaymentDto.reference}`);
            }
          }
        }
      } else {
        // Crypto verification - TODO: implement proper crypto verification
        verificationResult = {
          status: 'success',
          reference: verifyPaymentDto.reference,
          amount: payment.amount.toNumber(),
          currency: payment.currency,
          paid_at: new Date().toISOString(),
          orderId: payment.orderId,
          verificationMethod: 'crypto_auto'
        };
      }

      // Only update payment status if verification was successful
      if (verificationResult.status === 'success') {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.COMPLETED,
            updatedAt: new Date()
          }
        });

        this.logger.log(`Payment completed for order: ${payment.orderId}`);
      } else if (verificationResult.status === 'failed') {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.FAILED,
            updatedAt: new Date()
          }
        });

        this.logger.error(`Payment failed for order: ${payment.orderId} - ${verificationResult.error}`);
      }
      // For pending status, keep payment as is

      // MANUAL APPROVAL: Do NOT auto-process orders after payment
      // Orders remain PENDING until admin manually approves them
      // await this.prisma.order.update({
      //   where: { id: payment.orderId },
      //   data: {
      //     status: OrderStatus.PENDING, // Ready for processing
      //     updatedAt: new Date()
      //   }
      // });

      return {
        success: true,
        data: verificationResult
      };

    } catch (error) {
      this.logger.error(`Payment verification failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getPaymentStatus(orderId: string) {
    this.logger.debug(`Getting payment status for order: ${orderId}`);

    try {
      const payment = await this.prisma.payment.findUnique({
        where: { orderId: orderId },
        include: {
          order: true
        }
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
        updatedAt: payment.updatedAt.toISOString()
      };

    } catch (error) {
      this.logger.error(`Failed to get payment status: ${error.message}`, error.stack);
      throw error;
    }
  }

  async handleBudpayWebhook(payload: any, headers?: any, ipAddress?: string, userAgent?: string) {
    this.logger.debug('Processing BudPay webhook', payload);

    try {
      // Use BudPay service to handle webhook with transaction history and notifications
      const result = await this.budPayService.handleWebhook(payload, this.prisma, this.notificationService, headers, ipAddress, userAgent);
      return result;

    } catch (error) {
      this.logger.error(`Webhook processing failed: ${error.message}`, error.stack);
      throw error;
    }
  }
} 