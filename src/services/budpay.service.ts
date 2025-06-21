import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface BudPayVirtualAccount {
  accountNumber: string;
  accountName: string;
  bankName: string;
  bankCode: string;
  reference: string;
  expiresAt: string;
}

// Cool abstract names for anonymous customers
const ABSTRACT_NAMES = {
  first: [
    'Quantum', 'Stellar', 'Cosmic', 'Nebula', 'Aurora', 'Phoenix', 'Cipher', 'Echo',
    'Zenith', 'Prism', 'Vortex', 'Pixel', 'Nexus', 'Matrix', 'Flux', 'Nova',
    'Orbit', 'Pulse', 'Shift', 'Spark', 'Wave', 'Flow', 'Grid', 'Code',
    'Alpha', 'Beta', 'Delta', 'Gamma', 'Sigma', 'Omega', 'Zero', 'Unity',
    'Core', 'Edge', 'Link', 'Node', 'Path', 'Zone', 'Neon', 'Cyber',
    'Digital', 'Virtual', 'Astro', 'Cosmic', 'Neural', 'Binary', 'Chrome', 'Steel'
  ],
  last: [
    'Spirit', 'Shadow', 'Thunder', 'Lightning', 'Storm', 'Blaze', 'Frost', 'Mist',
    'Dream', 'Vision', 'Force', 'Power', 'Energy', 'Light', 'Dark', 'Fire',
    'Ocean', 'Mountain', 'Sky', 'Star', 'Moon', 'Sun', 'Wind', 'Rain',
    'Crystal', 'Diamond', 'Gold', 'Silver', 'Platinum', 'Titanium', 'Carbon', 'Neon',
    'Pulse', 'Wave', 'Beam', 'Ray', 'Flash', 'Glow', 'Shine', 'Spark',
    'Core', 'Edge', 'Peak', 'Ridge', 'Valley', 'Flow', 'Stream', 'River'
  ]
};

export interface BudPayPaymentVerification {
  status: 'success' | 'failed' | 'pending';
  reference: string;
  amount: number;
  currency: string;
  paidAt?: string;
  customerEmail?: string;
}

@Injectable()
export class BudPayService {
  private readonly logger = new Logger(BudPayService.name);
  private readonly httpClient: AxiosInstance;
  private readonly secretKey: string;

  constructor(private readonly configService: ConfigService) {
    this.secretKey = this.configService.get<string>('BUDPAY_SECRET_KEY');
    
    if (!this.secretKey) {
      this.logger.warn('BUDPAY_SECRET_KEY not found in environment variables');
    }

    this.httpClient = axios.create({
      baseURL: 'https://api.budpay.com/api/v2',
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 seconds timeout
    });

    // Add request/response interceptors for logging
    this.httpClient.interceptors.request.use(
      (config) => {
        this.logger.debug(`BudPay API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        this.logger.error('BudPay API Request Error:', error.message);
        return Promise.reject(error);
      }
    );

    this.httpClient.interceptors.response.use(
      (response) => {
        this.logger.debug(`BudPay API Response: ${response.status} ${response.statusText}`);
        return response;
      },
      (error) => {
        this.logger.error('BudPay API Response Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  private generateAbstractName(): { firstName: string; lastName: string; fullName: string } {
    const firstName = ABSTRACT_NAMES.first[Math.floor(Math.random() * ABSTRACT_NAMES.first.length)];
    const lastName = ABSTRACT_NAMES.last[Math.floor(Math.random() * ABSTRACT_NAMES.last.length)];
    const fullName = `${firstName} ${lastName}`;
    
    this.logger.debug(`Generated abstract name: ${fullName}`);
    return { firstName, lastName, fullName };
  }

  async createVirtualAccount(
    amount: number,
    currency: string = 'NGN',
    reference: string,
    customerEmail: string = 'customer@boostlab.com',
    customerName?: string // Make optional since we'll generate abstract names
  ): Promise<BudPayVirtualAccount> {
    try {
      this.logger.log(`Creating virtual account for amount: ${amount} ${currency}, reference: ${reference}`);

      // Generate abstract name instead of using real customer name
      const abstractName = this.generateAbstractName();
      const randomEmail = `${abstractName.firstName.toLowerCase()}.${abstractName.lastName.toLowerCase()}@boostlab.com`;

      const customerPayload = {
        email: randomEmail,
        first_name: abstractName.firstName,
        last_name: abstractName.lastName,
        phone: '+2348123456789' // Default phone for now
      };

      this.logger.debug(`Creating customer with abstract name: ${abstractName.fullName}`);
      const customerResponse = await this.httpClient.post('/customer', customerPayload);

      if (!customerResponse.data.status) {
        throw new Error(`BudPay Customer Creation Error: ${customerResponse.data.message}`);
      }

      const customerCode = customerResponse.data.data.customer_code;
      this.logger.log(`Customer created successfully: ${customerCode} (${abstractName.fullName})`);

      // Step 2: Create dedicated virtual account
      const accountPayload = {
        customer: customerCode,
        first_name: abstractName.firstName,
        last_name: abstractName.lastName,
        phone: '+2348123456789'
      };

      this.logger.debug('Creating dedicated virtual account with BudPay API');
      const response = await this.httpClient.post('/dedicated_virtual_account', accountPayload);

      if (response.data.status === true) {
        const accountData = response.data.data;
        
        return {
          accountNumber: accountData.account_number.toString(),
          accountName: accountData.account_name,
          bankName: accountData.bank.name,
          bankCode: accountData.bank.bank_code,
          reference: reference,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        };
      } else {
        throw new Error(`BudPay Virtual Account Error: ${response.data.message}`);
      }

    } catch (error) {
      this.logger.error(`Failed to create virtual account: ${error.message}`, error.stack);
      
      // Fallback to static account with abstract name if API fails
      const fallbackName = this.generateAbstractName();
      this.logger.warn(`Falling back to static account details with abstract name: ${fallbackName.fullName}`);
      return {
        accountNumber: '2054327890',
        accountName: `Boost Lab Limited / ${fallbackName.fullName}`,
        bankName: 'Wema Bank',
        bankCode: '035',
        reference: reference,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      };
    }
  }

  async verifyPayment(reference: string): Promise<BudPayPaymentVerification> {
    try {
      this.logger.log(`Verifying payment with BudPay API: ${reference}`);

      const response = await this.httpClient.get(`/transaction/verify/${reference}`);

      if (response.data.status === true) {
        const transactionData = response.data.data;
        
        // Map BudPay status to our status format
        let paymentStatus: 'success' | 'failed' | 'pending' = 'pending';
        if (transactionData.status === 'success') {
          paymentStatus = 'success';
        } else if (transactionData.status === 'failed') {
          paymentStatus = 'failed';
        }

        return {
          status: paymentStatus,
          reference: transactionData.reference,
          amount: parseFloat(transactionData.amount || transactionData.requested_amount || '0'),
          currency: transactionData.currency || 'NGN',
          paidAt: transactionData.transaction_date || (paymentStatus === 'success' ? new Date().toISOString() : undefined),
          customerEmail: transactionData.customer?.email,
        };
      } else {
        this.logger.warn(`BudPay verification failed: ${response.data.message}`);
        return {
          status: 'failed',
          reference: reference,
          amount: 0,
          currency: 'NGN',
        };
      }

    } catch (error) {
      this.logger.error(`BudPay verification API error: ${error.message}`, error.stack);
      
      // NO FALLBACK SIMULATION - Return actual error status
      if (error.response?.status === 404) {
        this.logger.warn('Transaction not found in BudPay');
        return {
          status: 'failed',
          reference: reference,
          amount: 0,
          currency: 'NGN',
        };
      }

      // Return failed status for any API errors
      return {
        status: 'failed',
        reference: reference,
        amount: 0,
        currency: 'NGN',
      };
    }
  }

  async checkVirtualAccountTransactions(accountReference: string): Promise<BudPayPaymentVerification[]> {
    try {
      this.logger.log(`Checking virtual account transactions for reference: ${accountReference}`);

      // List all dedicated accounts to find the one with our reference
      const accountsResponse = await this.httpClient.get('/list_dedicated_accounts');
      
      if (accountsResponse.data.status === true) {
        const accounts = accountsResponse.data.data;
        
        // Find account by our reference (stored in the account creation)
        const targetAccount = accounts.find((account: any) => 
          account.reference === accountReference || 
          account.account_number === accountReference
        );

        if (targetAccount) {
          // Get detailed account info including transactions
          const accountDetailResponse = await this.httpClient.get(`/dedicated_account/${targetAccount.id}`);
          
          if (accountDetailResponse.data.status === true) {
            const accountDetail = accountDetailResponse.data.data;
            const transactions = accountDetail.transactions || [];
            
            return transactions.map((transaction: any) => ({
              status: transaction.status === 'success' ? 'success' : 'failed',
              reference: transaction.reference,
              amount: parseFloat(transaction.amount || '0'),
              currency: transaction.currency || 'NGN',
              paidAt: transaction.paid_at || transaction.createdAt,
              customerEmail: accountDetail.customer?.email,
            }));
          }
        }
      }

      return [];
    } catch (error) {
      this.logger.error(`Failed to check virtual account transactions: ${error.message}`, error.stack);
      return [];
    }
  }

  async handleWebhook(payload: any, prismaService: any, notificationService?: any, headers?: any, ipAddress?: string, userAgent?: string): Promise<{ success: boolean; message: string }> {
    let webhookLogId: string | null = null;
    
    try {
      this.logger.log('🔔 WEBHOOK RECEIVED - Processing immediately...', JSON.stringify(payload, null, 2));

      // 1. IMMEDIATELY save webhook to database for audit trail
      const webhookLog = await prismaService.webhookLog.create({
        data: {
          provider: 'budpay',
          event: payload.notifyType || 'unknown',
          payload: payload,
          headers: headers || {},
          processed: false,
          ipAddress: ipAddress,
          userAgent: userAgent
        }
      });
      webhookLogId = webhookLog.id;
      this.logger.log(`📝 Webhook logged with ID: ${webhookLogId}`);

      // Validate webhook payload
      if (!payload.data) {
        const errorMsg = 'Invalid webhook payload: missing data';
        await prismaService.webhookLog.update({
          where: { id: webhookLogId },
          data: { processed: true, processingError: errorMsg }
        });
        throw new Error(errorMsg);
      }

      const eventData = payload.data;
      const reference = eventData.reference;
      
      if (!reference) {
        const errorMsg = 'Invalid webhook payload: missing reference';
        await prismaService.webhookLog.update({
          where: { id: webhookLogId },
          data: { processed: true, processingError: errorMsg }
        });
        throw new Error(errorMsg);
      }

      // BudPay uses notifyType instead of event
      const notifyType = payload.notifyType;
      this.logger.log(`🚀 PROCESSING WEBHOOK EVENT: ${notifyType} - Finding payment immediately...`);

      let paymentId: string | null = null;
      let orderId: string | null = null;
      let transactionId: string | null = null;

      // Handle different webhook events based on notifyType and status
      if (notifyType === 'successful' || eventData.status === 'success') {
        const result = await this.processSuccessfulTransaction(eventData, prismaService, notificationService);
        paymentId = result?.paymentId;
        orderId = result?.orderId;
        transactionId = result?.transactionId;
      } else if (notifyType === 'failed' || eventData.status === 'failed') {
        const result = await this.processFailedTransaction(eventData, prismaService, notificationService);
        paymentId = result?.paymentId;
        orderId = result?.orderId;
        transactionId = result?.transactionId;
      } else {
        this.logger.log(`❌ Unhandled webhook notifyType: ${notifyType}, status: ${eventData.status}`);
      }

      // Update webhook log with processing results
      await prismaService.webhookLog.update({
        where: { id: webhookLogId },
        data: {
          processed: true,
          paymentId: paymentId,
          orderId: orderId,
          transactionId: transactionId
        }
      });

      this.logger.log(`✅ WEBHOOK PROCESSED SUCCESSFULLY - Payment: ${paymentId}, Order: ${orderId}, Transaction: ${transactionId}`);

      return {
        success: true,
        message: 'Webhook processed successfully'
      };

    } catch (error) {
      this.logger.error(`❌ WEBHOOK PROCESSING FAILED: ${error.message}`, error.stack);
      
      // Update webhook log with error
      if (webhookLogId) {
        try {
          await prismaService.webhookLog.update({
            where: { id: webhookLogId },
            data: {
              processed: true,
              processingError: error.message
            }
          });
        } catch (logError) {
          this.logger.error(`Failed to update webhook log: ${logError.message}`);
        }
      }
      
      return {
        success: false,
        message: 'Webhook processing failed'
      };
    }
  }

  private async processSuccessfulTransaction(eventData: any, prismaService: any, notificationService?: any): Promise<{paymentId?: string, orderId?: string, transactionId?: string}> {
    try {
      const budpayReference = eventData.reference;
      const amount = parseFloat(eventData.amount || eventData.requested_amount || '0');
      const virtualAccount = eventData.craccount; // The virtual account number
      
      this.logger.log(`🔍 Processing successful transaction: ${budpayReference}, amount: ₦${amount}, account: ${virtualAccount}`);
      this.logger.log(`💰 Matching logic: Looking for ₦${amount} (direct) OR ₦${amount + 50} (with ₦50 fee) OR account ${virtualAccount}`);

      // Find payment by virtual account number (stored in gatewayRef during payment creation)
      // We'll search through all pending payments and check if this virtual account was used
      const allPendingPayments = await prismaService.payment.findMany({
        where: {
          status: 'PENDING',
          method: 'NGN'
        },
        include: { 
          order: {
            include: {
              service: true,
              platform: true
            }
          }
        }
      });

      // Since we can't directly map virtual account to payment, we'll match by amount
      // Account for BudPay fees: received amount + fees should match expected amount
      const expectedAmount = amount;
      const matchingPayment = allPendingPayments.find(payment => {
        const paymentAmount = payment.amount.toNumber();
        
        // Method 1: Direct amount match (tolerance: 1 naira)
        const directMatch = Math.abs(paymentAmount - expectedAmount) < 1;
        
        // Method 2: Account for BudPay fees (₦50 typical fee)
        // received_amount + fee ≈ expected_amount
        const withFees = expectedAmount + 50; // Add back the ₦50 fee
        const feeAdjustedMatch = Math.abs(paymentAmount - withFees) < 1;
        
        // Method 3: Check if virtual account matches (if available)
        const accountMatch = virtualAccount && payment.gatewayRef && 
          payment.gatewayRef.includes(virtualAccount);
        
        return directMatch || feeAdjustedMatch || accountMatch;
      });

      if (!matchingPayment) {
        this.logger.warn(`No matching payment found for amount: ${amount}, virtual account: ${virtualAccount}`);
        this.logger.warn(`Available pending payments:`, allPendingPayments.map(p => ({
          id: p.id,
          amount: p.amount.toString(),
          reference: p.gatewayRef
        })));
        return {};
      }

      this.logger.log(`✅ FOUND MATCHING PAYMENT: ${matchingPayment.id} for order: ${matchingPayment.order.id}`);
      this.logger.log(`💰 Payment details: Expected ₦${matchingPayment.amount.toString()}, Received ₦${amount}, Account: ${virtualAccount}`);

      // Check if transaction already exists
      const existingTransaction = await prismaService.transaction.findFirst({
        where: {
          budpayReference: budpayReference
        }
      });

      if (existingTransaction) {
        this.logger.warn(`Transaction already exists for BudPay reference: ${budpayReference}`);
        return {
          paymentId: matchingPayment.id,
          orderId: matchingPayment.order.id,
          transactionId: existingTransaction.id
        };
      }

      // Create transaction record
      const transaction = await prismaService.transaction.create({
        data: {
          paymentId: matchingPayment.id,
          budpayReference: budpayReference,
          ourReference: matchingPayment.gatewayRef,
          amount: amount,
          currency: eventData.currency || 'NGN',
          status: 'COMPLETED',
          budpayStatus: eventData.status,
          accountNumber: virtualAccount,
          bankName: eventData.bankname || eventData.bank_name,
          customerEmail: eventData.customer?.email,
          narration: eventData.narration,
          sessionId: eventData.sessionid || eventData.session_id,
          paidAt: new Date(eventData.paid_at || eventData.created_at),
          webhookReceived: true,
          webhookData: eventData
        }
      });

      // Update payment status
      await prismaService.payment.update({
        where: { id: matchingPayment.id },
        data: {
          status: 'COMPLETED',
          updatedAt: new Date()
        }
      });

      this.logger.log(`Payment completed via webhook: ${matchingPayment.id} for order: ${matchingPayment.order.id}`);
      this.logger.log(`Transaction record created: ${transaction.id}`);

      // Send push notification for payment received
      if (notificationService && matchingPayment.order.userId) {
        try {
          await notificationService.sendOrderNotification(matchingPayment.order.id, 'payment_received');
          this.logger.log(`Payment notification sent for order: ${matchingPayment.order.id}`);
        } catch (notificationError) {
          this.logger.error(`Failed to send payment notification: ${notificationError.message}`);
          // Don't throw error, payment processing should still succeed
        }
      }

      return {
        paymentId: matchingPayment.id,
        orderId: matchingPayment.order.id,
        transactionId: transaction.id
      };

    } catch (error) {
      this.logger.error(`Failed to process successful transaction: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async processFailedTransaction(eventData: any, prismaService: any, notificationService?: any): Promise<{paymentId?: string, orderId?: string, transactionId?: string}> {
    try {
      const budpayReference = eventData.reference;
      const amount = parseFloat(eventData.amount || eventData.requested_amount || '0');
      const virtualAccount = eventData.craccount;
      
      this.logger.log(`Processing failed transaction: ${budpayReference}, amount: ${amount}, account: ${virtualAccount}`);

      // Find payment by matching amount since we can't directly map virtual account
      const allPendingPayments = await prismaService.payment.findMany({
        where: {
          status: 'PENDING',
          method: 'NGN'
        },
        include: { order: true }
      });

      const expectedAmount = amount;
      const matchingPayment = allPendingPayments.find(payment => {
        const paymentAmount = payment.amount.toNumber();
        
        // Method 1: Direct amount match (tolerance: 1 naira)
        const directMatch = Math.abs(paymentAmount - expectedAmount) < 1;
        
        // Method 2: Account for BudPay fees (₦50 typical fee)
        const withFees = expectedAmount + 50;
        const feeAdjustedMatch = Math.abs(paymentAmount - withFees) < 1;
        
        // Method 3: Check if virtual account matches (if available)
        const accountMatch = virtualAccount && payment.gatewayRef && 
          payment.gatewayRef.includes(virtualAccount);
        
        return directMatch || feeAdjustedMatch || accountMatch;
      });

      if (!matchingPayment) {
        this.logger.warn(`No matching payment found for failed transaction amount: ${amount}, virtual account: ${virtualAccount}`);
        return {};
      }

      // Check if transaction already exists
      const existingTransaction = await prismaService.transaction.findFirst({
        where: {
          budpayReference: budpayReference
        }
      });

      if (existingTransaction) {
        this.logger.warn(`Transaction already exists for BudPay reference: ${budpayReference}`);
        return {
          paymentId: matchingPayment.id,
          orderId: matchingPayment.order.id,
          transactionId: existingTransaction.id
        };
      }

      // Create transaction record
      const transaction = await prismaService.transaction.create({
        data: {
          paymentId: matchingPayment.id,
          budpayReference: budpayReference,
          ourReference: matchingPayment.gatewayRef,
          amount: amount,
          currency: eventData.currency || 'NGN',
          status: 'FAILED',
          budpayStatus: eventData.status,
          accountNumber: virtualAccount,
          bankName: eventData.bankname || eventData.bank_name,
          customerEmail: eventData.customer?.email,
          narration: eventData.narration,
          sessionId: eventData.sessionid || eventData.session_id,
          webhookReceived: true,
          webhookData: eventData
        }
      });

      // Update payment status
      await prismaService.payment.update({
        where: { id: matchingPayment.id },
        data: {
          status: 'FAILED',
          updatedAt: new Date()
        }
      });

      this.logger.log(`Payment failed via webhook: ${matchingPayment.id} for order: ${matchingPayment.order.id}`);
      this.logger.log(`Transaction record created: ${transaction.id}`);

      return {
        paymentId: matchingPayment.id,
        orderId: matchingPayment.order.id,
        transactionId: transaction.id
      };

    } catch (error) {
      this.logger.error(`Failed to process failed transaction: ${error.message}`, error.stack);
      throw error;
    }
  }
} 