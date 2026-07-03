import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BankAccountStatus, KycStatus } from '@prisma/client';
import {
  accountNameMatchesIdentity,
} from '../common/utils/name-matching.util';
import { isKycDevMode } from '../common/utils/kyc-mode.util';
import { NyraApiService } from '../providers/nyra/nyra-api.service';
import { NyraTransferBank } from '../providers/nyra/nyra.types';
import { PrismaService } from '../prisma/prisma.service';

export interface AddBankAccountInput {
  bankName: string;
  bankCode?: string;
  accountNumber: string;
}

@Injectable()
export class BankAccountsService {
  private readonly logger = new Logger(BankAccountsService.name);
  private banksCache: NyraTransferBank[] | null = null;
  private banksCacheAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly nyraApi: NyraApiService,
  ) {}

  async listBanks() {
    return this.getTransferBanks();
  }

  async listAccounts(userId: string) {
    const accounts = await this.prisma.bankAccount.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return accounts.map((account) => this.toResponse(account));
  }

  async getAccount(userId: string, id: string) {
    const account = await this.prisma.bankAccount.findFirst({
      where: { id, userId },
    });
    if (!account) {
      throw new NotFoundException('Bank account not found');
    }
    return this.toResponse(account);
  }

  async addAccount(userId: string, input: AddBankAccountInput) {
    if (!/^\d{10}$/.test(input.accountNumber)) {
      throw new BadRequestException('Account number must be exactly 10 digits');
    }

    const kyc = await this.prisma.userKyc.findUnique({ where: { userId } });
    if (!kyc || kyc.status !== KycStatus.VERIFIED) {
      throw new BadRequestException(
        'Your KYC must be approved by admin before adding a bank account',
      );
    }

    const devMode = isKycDevMode(this.configService);
    const bank = await this.resolveBank(input.bankName, input.bankCode);
    const resolvedName = devMode
      ? this.buildDevAccountName(kyc.bvnNames, kyc.ninNames)
      : await this.resolveAccountName(input.accountNumber, bank.code);
    const matches =
      devMode ||
      accountNameMatchesIdentity(resolvedName, kyc.bvnNames, kyc.ninNames, 2);

    const status = matches ? BankAccountStatus.APPROVED : BankAccountStatus.REJECTED;
    const rejectionReason = matches
      ? null
      : 'Account name does not match your BVN and NIN records. At least 2 name parts must match on both BVN and NIN.';

    const existingCount = await this.prisma.bankAccount.count({ where: { userId } });

    const account = await this.prisma.bankAccount.upsert({
      where: {
        userId_bankName_accountNumber: {
          userId,
          bankName: bank.name,
          accountNumber: input.accountNumber,
        },
      },
      create: {
        userId,
        bankName: bank.name,
        bankCode: bank.code,
        accountNumber: input.accountNumber,
        accountName: resolvedName,
        status,
        rejectionReason,
        isDefault: existingCount === 0 && status === BankAccountStatus.APPROVED,
      },
      update: {
        bankCode: bank.code,
        accountName: resolvedName,
        status,
        rejectionReason,
      },
    });

    this.logger.log(
      `Bank account ${account.id} for user ${userId} → ${status} (${resolvedName})`,
    );

    return this.toResponse(account);
  }

  async requireApprovedAccount(userId: string, accountId: string) {
    const account = await this.prisma.bankAccount.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) {
      throw new NotFoundException('Bank account not found');
    }
    if (account.status !== BankAccountStatus.APPROVED) {
      throw new BadRequestException('Bank account is not approved for withdrawals');
    }
    if (!account.bankCode) {
      throw new BadRequestException('Bank account is missing a bank code. Please re-add the account.');
    }
    return account;
  }

  private async getTransferBanks(): Promise<NyraTransferBank[]> {
    const now = Date.now();
    if (this.banksCache && now - this.banksCacheAt < 60 * 60 * 1000) {
      return this.banksCache;
    }

    const banks = await this.nyraApi.listTransferBanks();
    this.banksCache = banks;
    this.banksCacheAt = now;
    return banks;
  }

  private async resolveBank(bankName: string, bankCode?: string) {
    if (bankCode) {
      return { name: bankName, code: bankCode };
    }

    const banks = await this.getTransferBanks();
    const normalized = bankName.trim().toLowerCase();
    const match = banks.find((bank) => {
      const name = bank.name.toLowerCase();
      const slug = bank.slug?.toLowerCase();
      return (
        name === normalized ||
        name.includes(normalized) ||
        normalized.includes(name) ||
        slug === normalized.replace(/\s+/g, '-')
      );
    });

    if (!match) {
      throw new BadRequestException(
        `Could not resolve bank code for "${bankName}". Provide bankCode from GET /bank-accounts/banks.`,
      );
    }

    return { name: match.name, code: match.code };
  }

  private buildDevAccountName(bvnNames: string[], ninNames: string[]): string {
    const tokens = [...new Set([...bvnNames, ...ninNames])];
    if (tokens.length >= 2) {
      return tokens.map((token) => token.charAt(0).toUpperCase() + token.slice(1)).join(' ');
    }
    return 'Test User';
  }

  private async resolveAccountName(
    accountNumber: string,
    bankCode: string,
  ): Promise<string> {
    const enquiry = await this.nyraApi.transferNameEnquiry(accountNumber, bankCode);
    return enquiry.account.name;
  }

  private toResponse(account: {
    id: string;
    bankName: string;
    bankCode: string | null;
    accountNumber: string;
    accountName: string;
    status: BankAccountStatus;
    rejectionReason: string | null;
    isDefault: boolean;
    createdAt: Date;
  }) {
    return {
      id: account.id,
      bankName: account.bankName,
      bankCode: account.bankCode || undefined,
      accountNumber: account.accountNumber,
      accountName: account.accountName,
      status: account.status,
      rejectionReason: account.rejectionReason,
      isDefault: account.isDefault,
      createdAt: account.createdAt.toISOString(),
    };
  }
}
