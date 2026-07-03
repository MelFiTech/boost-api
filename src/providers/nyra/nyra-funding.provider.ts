import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProviderKind } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateFundingAccountParams,
  FundingAccountDetails,
  FundingProvider,
} from '../provider.types';
import { buildNyraFundingRequest } from './nyra-funding-request.builder';
import { NyraApiService } from './nyra-api.service';
import { NyraFundingRail } from './nyra.types';

@Injectable()
export class NyraFundingProvider implements FundingProvider {
  readonly name = 'nyra';

  constructor(
    private readonly nyraApi: NyraApiService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async createFundingAccount(params: CreateFundingAccountParams): Promise<FundingAccountDetails> {
    const rail = await this.resolveFundingRail();
    const expiresIn = Number(this.configService.get<string>('NYRA_FUNDING_EXPIRES_IN') || 900);
    const request = buildNyraFundingRequest(rail, params, expiresIn);

    const account = await this.nyraApi.createDynamicFundingAccount(request);

    return {
      accountNumber: account.account_number,
      accountName: account.account_name,
      bankName: account.bank_name,
      bankCode: account.bank_code,
      reference: params.reference,
      expiresAt: account.expiry_date,
      providerAccountId: account.id,
      amount: account.amount,
      providerRail: rail,
    };
  }

  private async resolveFundingRail(): Promise<NyraFundingRail> {
    const config = await this.prisma.providerConfig.findFirst({
      where: { kind: ProviderKind.FUNDING, provider: 'nyra', active: true },
    });

    const stored = (config?.config as { nyraProvider?: string } | null)?.nyraProvider;
    if (stored === 'Flutterwave' || stored === 'Safe_Haven') {
      return stored;
    }

    const envRail = this.configService.get<string>('NYRA_FUNDING_PROVIDER');
    return envRail === 'Safe_Haven' ? 'Safe_Haven' : 'Flutterwave';
  }
}
