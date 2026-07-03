import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ProviderKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NyraFundingProvider } from './nyra/nyra-funding.provider';
import { NyraBillsProvider } from './nyra/nyra-bills.provider';
import { NYRA_FUNDING_RAILS, NyraFundingRail } from './nyra/nyra.types';
import { BillsProvider, FundingProvider } from './provider.types';

/**
 * Managed-wallet provider registry. The admin picks which provider is active
 * for each kind (FUNDING, BILLS) via ProviderConfig; the rest of the codebase
 * only ever asks the registry for "the active provider".
 */
@Injectable()
export class ProviderRegistryService implements OnModuleInit {
  private readonly logger = new Logger(ProviderRegistryService.name);

  private fundingProviders = new Map<string, FundingProvider>();
  private billsProviders = new Map<string, BillsProvider>();

  constructor(
    private readonly prisma: PrismaService,
    nyraFunding: NyraFundingProvider,
    nyraBills: NyraBillsProvider,
  ) {
    this.fundingProviders.set(nyraFunding.name, nyraFunding);
    this.billsProviders.set(nyraBills.name, nyraBills);
  }

  async onModuleInit() {
    const defaultRail = this.defaultNyraRailFromEnv();

    const activeFunding = await this.prisma.providerConfig.findFirst({
      where: { kind: ProviderKind.FUNDING, active: true },
    });

    if (!activeFunding || activeFunding.provider === 'budpay') {
      await this.prisma.providerConfig.updateMany({
        where: { kind: ProviderKind.FUNDING },
        data: { active: false },
      });
      await this.prisma.providerConfig.upsert({
        where: { kind_provider: { kind: ProviderKind.FUNDING, provider: 'nyra' } },
        update: { active: true, config: { nyraProvider: defaultRail } },
        create: {
          kind: ProviderKind.FUNDING,
          provider: 'nyra',
          active: true,
          config: { nyraProvider: defaultRail },
        },
      });
      this.logger.log(`Active FUNDING provider set to nyra (${defaultRail})`);
    } else if (activeFunding.provider === 'nyra') {
      const config = activeFunding.config as { nyraProvider?: string } | null;
      if (!config?.nyraProvider) {
        await this.prisma.providerConfig.update({
          where: { id: activeFunding.id },
          data: { config: { nyraProvider: defaultRail } },
        });
      }
    }

    await this.prisma.providerConfig.updateMany({
      where: { provider: 'budpay' },
      data: { active: false },
    });

    const activeBills = await this.prisma.providerConfig.findFirst({
      where: { kind: ProviderKind.BILLS, active: true },
    });
    if (!activeBills || activeBills.provider === 'budpay') {
      await this.prisma.providerConfig.updateMany({
        where: { kind: ProviderKind.BILLS },
        data: { active: false },
      });
      await this.prisma.providerConfig.upsert({
        where: { kind_provider: { kind: ProviderKind.BILLS, provider: 'nyra' } },
        update: { active: true },
        create: { kind: ProviderKind.BILLS, provider: 'nyra', active: true },
      });
      this.logger.log('Active BILLS provider set to nyra');
    }
  }

  private defaultNyraRailFromEnv(): NyraFundingRail {
    const envRail = process.env.NYRA_FUNDING_PROVIDER;
    return envRail === 'Safe_Haven' ? 'Safe_Haven' : 'Flutterwave';
  }

  async getNyraFundingRail(): Promise<NyraFundingRail> {
    const config = await this.prisma.providerConfig.findFirst({
      where: { kind: ProviderKind.FUNDING, provider: 'nyra', active: true },
    });
    const stored = (config?.config as { nyraProvider?: string } | null)?.nyraProvider;
    if (stored === 'Flutterwave' || stored === 'Safe_Haven') {
      return stored;
    }
    return this.defaultNyraRailFromEnv();
  }

  async setNyraFundingRail(rail: NyraFundingRail) {
    if (!NYRA_FUNDING_RAILS.includes(rail)) {
      throw new BadRequestException(`Invalid Nyra funding rail: ${rail}`);
    }

    const config = await this.prisma.providerConfig.upsert({
      where: { kind_provider: { kind: ProviderKind.FUNDING, provider: 'nyra' } },
      update: { active: true, config: { nyraProvider: rail } },
      create: {
        kind: ProviderKind.FUNDING,
        provider: 'nyra',
        active: true,
        config: { nyraProvider: rail },
      },
    });

    this.logger.log(`Nyra funding rail switched to ${rail}`);
    return config;
  }

  listNyraFundingRails() {
    return NYRA_FUNDING_RAILS;
  }

  private async getActiveProviderName(kind: ProviderKind): Promise<string> {
    const config = await this.prisma.providerConfig.findFirst({ where: { kind, active: true } });
    if (kind === ProviderKind.FUNDING) {
      return config?.provider || 'nyra';
    }
    if (kind === ProviderKind.BILLS) {
      return config?.provider || 'nyra';
    }
    return config?.provider || '';
  }

  async getFundingProvider(): Promise<FundingProvider> {
    const name = await this.getActiveProviderName(ProviderKind.FUNDING);
    const provider = this.fundingProviders.get(name);
    if (!provider) throw new BadRequestException(`Funding provider "${name}" is not registered`);
    return provider;
  }

  async getBillsProvider(): Promise<BillsProvider> {
    const name = await this.getActiveProviderName(ProviderKind.BILLS);
    if (!name) {
      throw new BadRequestException('No bills provider is configured');
    }
    const provider = this.billsProviders.get(name);
    if (!provider) throw new BadRequestException(`Bills provider "${name}" is not registered`);
    return provider;
  }

  registeredProviders() {
    return {
      FUNDING: [...this.fundingProviders.keys()],
      BILLS: [...this.billsProviders.keys()],
    };
  }

  async listConfigs() {
    return this.prisma.providerConfig.findMany({ orderBy: [{ kind: 'asc' }, { provider: 'asc' }] });
  }

  async setActiveProvider(kind: ProviderKind, providerName: string) {
    const registered =
      kind === ProviderKind.FUNDING
        ? this.fundingProviders.has(providerName)
        : this.billsProviders.has(providerName);
    if (!registered) {
      throw new BadRequestException(`Provider "${providerName}" is not registered for kind ${kind}`);
    }

    const [, config] = await this.prisma.$transaction([
      this.prisma.providerConfig.updateMany({ where: { kind }, data: { active: false } }),
      this.prisma.providerConfig.upsert({
        where: { kind_provider: { kind, provider: providerName } },
        update: { active: true },
        create: { kind, provider: providerName, active: true },
      }),
    ]);
    this.logger.log(`Active ${kind} provider switched to ${providerName}`);
    return config;
  }
}
