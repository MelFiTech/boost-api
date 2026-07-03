import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BankAccount } from '@prisma/client';
import { accountNameMatchesIdentity } from '../../common/utils/name-matching.util';
import { isKycDevMode } from '../../common/utils/kyc-mode.util';
import { NyraApiService } from './nyra-api.service';
import { NyraTransferResult } from './nyra.types';

export interface WithdrawTransferInput {
  amount: number;
  bankAccount: Pick<BankAccount, 'accountNumber' | 'accountName' | 'bankName' | 'bankCode'>;
  clientRequestId: string;
  description?: string;
  bvnNames: string[];
  ninNames: string[];
}

const WITHDRAWAL_TRANSFER_DESCRIPTION = 'Withdrawal from boostlab wallet';

@Injectable()
export class NyraTransferService {
  private readonly logger = new Logger(NyraTransferService.name);
  private cachedSourceAccount: string | null = null;

  constructor(
    private readonly nyraApi: NyraApiService,
    private readonly configService: ConfigService,
  ) {}

  async listBanks() {
    return this.nyraApi.listTransferBanks();
  }

  async resolveSourceFloatAccount(): Promise<string> {
    const configured =
      this.configService.get<string>('NYRA_TRANSFER_SOURCE_ACCOUNT') ||
      this.configService.get<string>('NYRA_SOURCE_ACCOUNT_NUMBER');
    if (configured) {
      return configured;
    }

    if (this.cachedSourceAccount) {
      return this.cachedSourceAccount;
    }

    const floats = await this.nyraApi.listFloatWallets();
    const businessFloat =
      floats.find((wallet) => wallet.is_business_float === true) || floats[0];

    if (!businessFloat?.account_number) {
      throw new BadRequestException(
        'No Nyra business float account is configured. Set NYRA_TRANSFER_SOURCE_ACCOUNT or fund a float wallet.',
      );
    }

    this.cachedSourceAccount = businessFloat.account_number;
    this.logger.log(`Using Nyra float source account ${this.maskAccount(this.cachedSourceAccount)}`);
    return this.cachedSourceAccount;
  }

  async initiateWithdrawalTransfer(input: WithdrawTransferInput): Promise<NyraTransferResult> {
    if (!input.bankAccount.bankCode) {
      throw new BadRequestException('Bank code is required for withdrawals');
    }

    const sourceAccount = await this.resolveSourceFloatAccount();

    const masterWallet = await this.nyraApi.getBusinessWalletBalance();
    if (masterWallet.available_balance < input.amount) {
      throw new BadRequestException(
        'Withdrawals are temporarily unavailable due to insufficient provider liquidity. Please try again later.',
      );
    }

    const enquiry = await this.nyraApi.transferNameEnquiry(
      input.bankAccount.accountNumber,
      input.bankAccount.bankCode,
    );

    const devMode = isKycDevMode(this.configService);
    if (
      !devMode &&
      !accountNameMatchesIdentity(enquiry.account.name, input.bvnNames, input.ninNames, 2)
    ) {
      throw new BadRequestException(
        'Beneficiary account name does not match your verified BVN and NIN records.',
      );
    }

    const senderName =
      this.configService.get<string>('NYRA_TRANSFER_SENDER_NAME') || 'BOOSTLAB';

    const result = await this.nyraApi.initiateTransfer({
      source_account_number: sourceAccount,
      amount: input.amount,
      description: WITHDRAWAL_TRANSFER_DESCRIPTION,
      sender_name: senderName,
      client_request_id: input.clientRequestId,
      beneficiary: {
        account_number: input.bankAccount.accountNumber,
        bank_code: input.bankAccount.bankCode,
        account_name: enquiry.account.name,
        bank_name: enquiry.bank_name || input.bankAccount.bankName,
        enquiry_session_id: enquiry.sessionId,
      },
    });

    this.logger.log(
      `Nyra withdrawal transfer ${result.transaction_id} → ${this.maskAccount(input.bankAccount.accountNumber)} (${result.transaction_status})`,
    );

    return result;
  }

  async getTransferStatus(transactionId: string) {
    return this.nyraApi.getBusinessTransaction(transactionId);
  }

  private maskAccount(accountNumber: string): string {
    if (accountNumber.length <= 4) return accountNumber;
    return `••••${accountNumber.slice(-4)}`;
  }
}
