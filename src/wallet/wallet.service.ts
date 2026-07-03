import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  Prisma,
  TransactionStatus,
  WalletTransactionCategory,
  WalletTransactionType,
  BillType,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { BankAccountsService } from '../bank-accounts/bank-accounts.service';
import { AppSettingsService } from '../app-settings/app-settings.service';
import { accountNameMatchesIdentity } from '../common/utils/name-matching.util';
import { KycService } from '../kyc/kyc.service';
import { PinService } from '../pin/pin.service';
import { NyraTransferService } from '../providers/nyra/nyra-transfer.service';
import { ProviderRegistryService } from '../providers/provider-registry.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../services/notification.service';
import { WalletGateway } from './wallet.gateway';
import { formatTransactionTitle } from './transaction-title.util';

export interface LedgerEntryInput {
  userId: string;
  type: WalletTransactionType;
  category: WalletTransactionCategory;
  amount: number; // always positive
  narration?: string;
  provider?: string;
  providerRef?: string;
  metadata?: Record<string, any>;
  referencePrefix?: string;
}

@Injectable()
export class WalletService implements OnModuleInit {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerRegistry: ProviderRegistryService,
    private readonly kycService: KycService,
    private readonly bankAccountsService: BankAccountsService,
    private readonly pinService: PinService,
    private readonly nyraTransferService: NyraTransferService,
    private readonly walletGateway: WalletGateway,
    private readonly appSettingsService: AppSettingsService,
    private readonly notificationService: NotificationService,
  ) {}

  onModuleInit() {
    this.walletGateway.snapshotProvider = async (userId) => this.getWallet(userId);
  }

  private pushBalanceUpdate(userId: string) {
    void this.getWallet(userId)
      .then((wallet) => this.walletGateway.pushUpdate(userId, wallet))
      .catch((error) => this.logger.warn(`Wallet push failed for ${userId}: ${error.message}`));
  }

  private serializeTransaction(
    tx: {
      id: string;
      type: WalletTransactionType;
      category: WalletTransactionCategory;
      amount: Prisma.Decimal;
      balanceAfter: Prisma.Decimal;
      reference: string;
      status: TransactionStatus;
      narration: string | null;
      metadata: Prisma.JsonValue;
      createdAt: Date;
      billPayment?: {
        billType: BillType;
        metadata: Prisma.JsonValue;
      } | null;
    },
  ) {
    const metadata = (tx.metadata || {}) as Record<string, unknown>;
    const billPayment = tx.billPayment
      ? {
          billType: tx.billPayment.billType,
          metadata: (tx.billPayment.metadata || {}) as Record<string, unknown>,
        }
      : null;

    return {
      id: tx.id,
      type: tx.type,
      category: tx.category,
      amount: tx.amount.toString(),
      balanceAfter: tx.balanceAfter.toString(),
      reference: tx.reference,
      status: tx.status,
      narration: tx.narration,
      title: formatTransactionTitle({
        category: tx.category,
        narration: tx.narration,
        metadata,
        billPayment,
      }),
      createdAt: tx.createdAt.toISOString(),
    };
  }

  private async pushTransactionUpdate(userId: string, transactionId: string) {
    const tx = await this.prisma.walletTransaction.findUnique({
      where: { id: transactionId },
      include: { billPayment: true },
    });
    if (!tx) return;
    const payload = this.serializeTransaction(tx);
    this.walletGateway.pushTransaction(userId, payload);
    void this.notificationService.notifyWalletTransaction(userId, payload);
  }

  private newReference(prefix: string): string {
    const p = prefix.replace(/_/g, '').slice(0, 3);
    return `${p}${randomBytes(8).toString('hex')}`;
  }

  async getOrCreateWallet(userId: string) {
    return this.prisma.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  async getWallet(userId: string) {
    const wallet = await this.getOrCreateWallet(userId);
    return {
      id: wallet.id,
      balance: wallet.balance.toString(),
      currency: wallet.currency,
      active: wallet.active,
    };
  }

  async getTransactions(userId: string, page = 1, limit = 20) {
    const wallet = await this.getOrCreateWallet(userId);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        include: { billPayment: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.walletTransaction.count({ where: { walletId: wallet.id } }),
    ]);
    return {
      items: rows.map((tx) => this.serializeTransaction(tx)),
      total,
      page,
      limit,
    };
  }

  /**
   * Applies a completed ledger entry atomically: locks the wallet row,
   * checks funds for debits, updates the balance, and writes the
   * immutable transaction row with before/after balances.
   */
  async applyLedgerEntry(entry: LedgerEntryInput) {
    if (entry.amount <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }
    const wallet = await this.getOrCreateWallet(entry.userId);
    const reference = this.newReference(entry.referencePrefix || 'wtx');

    return this.prisma.$transaction(async (tx) => {
      // Row lock so concurrent debits can't overdraw
      const [locked] = await tx.$queryRaw<{ balance: Prisma.Decimal }[]>`
        SELECT balance FROM wallets WHERE id = ${wallet.id} FOR UPDATE
      `;
      const balanceBefore = new Prisma.Decimal(locked.balance);
      const amount = new Prisma.Decimal(entry.amount.toFixed(2));

      const balanceAfter =
        entry.type === WalletTransactionType.CREDIT
          ? balanceBefore.plus(amount)
          : balanceBefore.minus(amount);

      if (balanceAfter.isNegative()) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter },
      });

      return tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: entry.type,
          category: entry.category,
          amount,
          balanceBefore,
          balanceAfter,
          reference,
          status: TransactionStatus.COMPLETED,
          provider: entry.provider,
          providerRef: entry.providerRef,
          narration: entry.narration,
          metadata: entry.metadata,
        },
      });
    }).then((transaction) => {
      this.pushBalanceUpdate(entry.userId);
      void this.pushTransactionUpdate(entry.userId, transaction.id);
      return transaction;
    });
  }

  /**
   * Starts a wallet funding: creates a PENDING credit row and asks the
   * active funding provider for account details the user should pay into.
   */
  async initiateFunding(userId: string, amount: number, email: string) {
    const { fundingFee } = await this.appSettingsService.getWalletFees();
    if (amount <= fundingFee) {
      throw new BadRequestException(
        `Amount must be greater than the funding fee of ₦${fundingFee.toLocaleString('en-NG')}`,
      );
    }
    const netCredit = parseFloat((amount - fundingFee).toFixed(2));

    if (amount < 300) {
      throw new BadRequestException('Minimum funding amount is ₦300');
    }
    const wallet = await this.getOrCreateWallet(userId);
    const provider = await this.providerRegistry.getFundingProvider();
    const reference = this.newReference('wf');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, email: true },
    });

    const account = await provider.createFundingAccount({
      amount,
      currency: wallet.currency,
      reference,
      customerEmail: email || user?.email || 'customer@boostlab.com',
      customerName: user?.username || email?.split('@')[0],
    });

    const pending = await this.prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: WalletTransactionType.CREDIT,
        category: WalletTransactionCategory.FUNDING,
        amount: new Prisma.Decimal(amount.toFixed(2)),
        balanceBefore: wallet.balance,
        balanceAfter: wallet.balance, // applied on confirmation
        reference,
        status: TransactionStatus.PENDING,
        provider: provider.name,
        narration: 'Wallet funding',
        metadata: {
          account: account as any,
          platformFee: fundingFee,
          grossAmount: amount,
          netCredit,
        },
      },
    });

    return {
      reference: pending.reference,
      amount,
      fundingFee,
      netCredit,
      currency: wallet.currency,
      provider: provider.name,
      providerRail: account.providerRail,
      account,
    };
  }

  /**
   * Confirms a pending funding (called from the payment webhook once the
   * provider reports the transfer as successful). Idempotent by reference.
   */
  async confirmFunding(reference: string, providerRef: string, paidAmount?: number) {
    const pending = await this.prisma.walletTransaction.findUnique({
      where: { reference },
      include: { wallet: true },
    });
    if (!pending) {
      throw new NotFoundException(`No funding transaction with reference ${reference}`);
    }
    if (pending.status === TransactionStatus.COMPLETED) {
      this.logger.warn(`Funding ${reference} already confirmed, ignoring duplicate webhook`);
      return pending;
    }

    const gross = new Prisma.Decimal((paidAmount ?? Number(pending.amount)).toFixed(2));
    const meta = (pending.metadata as {
      platformFee?: number;
      grossAmount?: number;
      netCredit?: number;
    } | null) || {};
    const platformFee = new Prisma.Decimal(
      (meta.platformFee ?? (await this.appSettingsService.getWalletFees()).fundingFee).toFixed(2),
    );
    const net = gross.minus(platformFee);
    if (net.lte(0)) {
      throw new BadRequestException('Funding amount is too low after platform fee');
    }

    const confirmed = await this.prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<{ balance: Prisma.Decimal }[]>`
        SELECT balance FROM wallets WHERE id = ${pending.walletId} FOR UPDATE
      `;
      const balanceBefore = new Prisma.Decimal(locked.balance);
      const balanceAfter = balanceBefore.plus(net);

      await tx.wallet.update({
        where: { id: pending.walletId },
        data: { balance: balanceAfter },
      });

      this.logger.log(
        `Wallet funding confirmed: ${reference} gross=${gross} fee=${platformFee} net=${net}`,
      );
      return tx.walletTransaction.update({
        where: { id: pending.id },
        data: {
          status: TransactionStatus.COMPLETED,
          amount: net,
          balanceBefore,
          balanceAfter,
          providerRef,
          metadata: {
            ...meta,
            platformFee: parseFloat(platformFee.toString()),
            grossAmount: parseFloat(gross.toString()),
            netCredit: parseFloat(net.toString()),
          },
        },
      });
    });

    this.pushBalanceUpdate(pending.wallet.userId);
    void this.pushTransactionUpdate(pending.wallet.userId, confirmed.id);
    return confirmed;
  }

  async getFundingStatus(userId: string, reference: string) {
    const wallet = await this.getOrCreateWallet(userId);
    const tx = await this.prisma.walletTransaction.findFirst({
      where: { walletId: wallet.id, reference, category: WalletTransactionCategory.FUNDING },
    });

    if (!tx) {
      return { status: 'NOT_FOUND' as const };
    }

    if (tx.status === TransactionStatus.COMPLETED) {
      return { status: 'COMPLETED' as const };
    }

    return { status: 'PENDING' as const };
  }

  async withdraw(userId: string, amount: number, bankAccountId: string, pin: string) {
    if (amount < 100) {
      throw new BadRequestException('Minimum withdrawal amount is ₦100');
    }

    const { withdrawalFee } = await this.appSettingsService.getWalletFees();
    const totalDebit = parseFloat((amount + withdrawalFee).toFixed(2));
    const wallet = await this.getOrCreateWallet(userId);
    if (parseFloat(wallet.balance.toString()) < totalDebit) {
      throw new BadRequestException(
        `Insufficient balance. You need ₦${totalDebit.toLocaleString('en-NG')} (₦${amount.toLocaleString('en-NG')} + ₦${withdrawalFee.toLocaleString('en-NG')} fee)`,
      );
    }

    await this.pinService.requireValidPin(userId, pin);
    const kyc = await this.kycService.requireVerified(userId);
    const bankAccount = await this.bankAccountsService.requireApprovedAccount(userId, bankAccountId);

    if (
      !this.kycService.isDevMode() &&
      !accountNameMatchesIdentity(bankAccount.accountName, kyc.bvnNames, kyc.ninNames, 2)
    ) {
      throw new BadRequestException(
        'Withdrawals are only allowed to bank accounts that match your BVN and NIN names (at least 2 name parts on each).',
      );
    }

    const debit = await this.applyLedgerEntry({
      userId,
      type: WalletTransactionType.DEBIT,
      category: WalletTransactionCategory.WITHDRAWAL,
      amount: totalDebit,
      narration: `Withdrawal to ${bankAccount.bankName} ••••${bankAccount.accountNumber.slice(-4)}`,
      provider: 'nyra',
      referencePrefix: 'wdr',
      metadata: {
        bankAccountId: bankAccount.id,
        bankName: bankAccount.bankName,
        bankCode: bankAccount.bankCode,
        accountNumber: bankAccount.accountNumber,
        accountName: bankAccount.accountName,
        platformFee: withdrawalFee,
        requestedAmount: amount,
        totalDebited: totalDebit,
      },
    });

    try {
      const transfer = await this.nyraTransferService.initiateWithdrawalTransfer({
        amount,
        bankAccount,
        clientRequestId: debit.reference,
        bvnNames: kyc.bvnNames,
        ninNames: kyc.ninNames,
      });

      const transferStatus = transfer.transaction_status?.toLowerCase();
      const isSuccessful = transferStatus === 'successful' || transferStatus === 'success';
      const isFailed = transferStatus === 'failed' || transferStatus === 'failure';

      const fee = Math.abs(transfer.charge ?? 0) + withdrawalFee;

      await this.prisma.walletTransaction.update({
        where: { id: debit.id },
        data: {
          providerRef: transfer.transaction_id,
          metadata: {
            ...(debit.metadata as object),
            nyra: {
              transaction_id: transfer.transaction_id,
              transaction_reference: transfer.transaction_reference,
              transaction_status: transfer.transaction_status,
              charge: transfer.charge,
            },
            providerTransferFee: Math.abs(transfer.charge ?? 0),
            platformFee: withdrawalFee,
          },
        },
      });

      if (isFailed) {
        await this.refundWithdrawal(userId, totalDebit, debit.id, 'Nyra transfer failed');
        throw new BadRequestException('Withdrawal transfer failed. Your wallet has been refunded.');
      }

      return {
        id: debit.id,
        reference: debit.reference,
        amount,
        withdrawalFee,
        totalDebited: totalDebit,
        fee,
        providerFee: Math.abs(transfer.charge ?? 0),
        status: isSuccessful ? ('COMPLETED' as const) : ('PROCESSING' as const),
        providerTransactionId: transfer.transaction_id,
        bankAccount: {
          bankName: bankAccount.bankName,
          accountNumber: bankAccount.accountNumber,
          accountName: bankAccount.accountName,
        },
        createdAt: debit.createdAt.toISOString(),
      };
    } catch (error) {
      const current = await this.prisma.walletTransaction.findUnique({ where: { id: debit.id } });
      if (current?.status !== TransactionStatus.REFUNDED) {
        const meta = (current?.metadata as { totalDebited?: number } | null) || {};
        await this.refundWithdrawal(
          userId,
          meta.totalDebited ?? totalDebit,
          debit.id,
          error.message,
        );
      }
      throw error instanceof BadRequestException
        ? error
        : new BadRequestException(`Withdrawal failed: ${error.message}`);
    }
  }

  async refundWithdrawal(
    userId: string,
    amount: number,
    withdrawalTransactionId: string,
    reason: string,
  ) {
    const existing = await this.prisma.walletTransaction.findUnique({
      where: { id: withdrawalTransactionId },
    });

    await this.applyLedgerEntry({
      userId,
      type: WalletTransactionType.CREDIT,
      category: WalletTransactionCategory.REFUND,
      amount,
      narration: 'Refund for failed withdrawal',
      provider: 'nyra',
      referencePrefix: 'rfd',
      metadata: { withdrawalTransactionId, reason },
    });

    await this.prisma.walletTransaction.update({
      where: { id: withdrawalTransactionId },
      data: {
        status: TransactionStatus.REFUNDED,
        metadata: {
          ...((existing?.metadata as object) || {}),
          error: reason,
        },
      },
    });
  }

  async getWithdrawalStatus(userId: string, reference: string) {
    const wallet = await this.getOrCreateWallet(userId);
    const tx = await this.prisma.walletTransaction.findFirst({
      where: {
        walletId: wallet.id,
        reference,
        category: WalletTransactionCategory.WITHDRAWAL,
      },
    });

    if (!tx) {
      return { status: 'NOT_FOUND' as const };
    }

    if (tx.status === TransactionStatus.REFUNDED) {
      return { status: 'FAILED' as const, reference: tx.reference };
    }

    if (tx.providerRef) {
      try {
        const nyraTxn = await this.nyraTransferService.getTransferStatus(tx.providerRef);
        const nyraStatus = nyraTxn.transaction_status?.toLowerCase();
        if (nyraStatus === 'failed' || nyraStatus === 'failure') {
          return { status: 'FAILED' as const, reference: tx.reference };
        }
        if (nyraStatus === 'successful' || nyraStatus === 'success') {
          return { status: 'COMPLETED' as const, reference: tx.reference };
        }
      } catch (error) {
        this.logger.warn(`Could not poll Nyra withdrawal ${tx.providerRef}: ${error.message}`);
      }
    }

    return {
      status: tx.status === TransactionStatus.COMPLETED ? ('COMPLETED' as const) : ('PROCESSING' as const),
      reference: tx.reference,
    };
  }
}
