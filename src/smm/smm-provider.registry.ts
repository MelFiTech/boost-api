import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ProviderKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SmmpanelkingService } from '../smmpanelking/smmpanelking.service';
import { SmmstoneService } from '../smmstone/smmstone.service';
import {
  SMM_PROVIDER_SLUGS,
  SmmProviderAdapter,
  SmmProviderSlug,
} from './smm-provider.types';

@Injectable()
export class SmmProviderRegistryService implements OnModuleInit {
  private readonly logger = new Logger(SmmProviderRegistryService.name);
  private readonly providers = new Map<SmmProviderSlug, SmmProviderAdapter>();

  constructor(
    private readonly prisma: PrismaService,
    smmstone: SmmstoneService,
    smmpanelking: SmmpanelkingService,
  ) {
    this.providers.set('smmstone', smmstone);
    this.providers.set('smmpanelking', smmpanelking);
  }

  async onModuleInit() {
    const active = await this.prisma.providerConfig.findFirst({
      where: { kind: ProviderKind.SMM, active: true },
    });

    if (!active) {
      await this.prisma.providerConfig.upsert({
        where: { kind_provider: { kind: ProviderKind.SMM, provider: 'smmstone' } },
        update: { active: true },
        create: { kind: ProviderKind.SMM, provider: 'smmstone', active: true },
      });
      this.logger.log('Active SMM provider set to smmstone');
    }
  }

  registeredSlugs(): SmmProviderSlug[] {
    return [...SMM_PROVIDER_SLUGS];
  }

  getProvider(slug: string): SmmProviderAdapter {
    const provider = this.providers.get(slug as SmmProviderSlug);
    if (!provider) {
      throw new BadRequestException(`SMM provider "${slug}" is not registered`);
    }
    return provider;
  }

  async getActiveSlug(): Promise<SmmProviderSlug> {
    const config = await this.prisma.providerConfig.findFirst({
      where: { kind: ProviderKind.SMM, active: true },
    });
    const slug = (config?.provider || 'smmstone') as SmmProviderSlug;
    if (!this.providers.has(slug)) {
      return 'smmstone';
    }
    return slug;
  }

  async getActiveProvider(): Promise<SmmProviderAdapter> {
    return this.getProvider(await this.getActiveSlug());
  }

  async setActiveProvider(slug: string) {
    if (!this.providers.has(slug as SmmProviderSlug)) {
      throw new BadRequestException(`SMM provider "${slug}" is not registered`);
    }

    const [, config] = await this.prisma.$transaction([
      this.prisma.providerConfig.updateMany({
        where: { kind: ProviderKind.SMM },
        data: { active: false },
      }),
      this.prisma.providerConfig.upsert({
        where: { kind_provider: { kind: ProviderKind.SMM, provider: slug } },
        update: { active: true },
        create: { kind: ProviderKind.SMM, provider: slug, active: true },
      }),
    ]);

    this.logger.log(`Active SMM provider switched to ${slug}`);
    return config;
  }

  async listConfigs() {
    return this.prisma.providerConfig.findMany({
      where: { kind: ProviderKind.SMM },
      orderBy: { provider: 'asc' },
    });
  }
}
