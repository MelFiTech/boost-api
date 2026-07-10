import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ProviderKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FleexaVirtualNumberProvider } from './fleexa/fleexa-virtual-number.provider';
import {
  VIRTUAL_NUMBER_PROVIDER_SLUGS,
  VirtualNumberProviderAdapter,
  VirtualNumberProviderSlug,
} from './virtual-number.provider.types';

@Injectable()
export class VirtualNumberProviderRegistryService implements OnModuleInit {
  private readonly logger = new Logger(VirtualNumberProviderRegistryService.name);
  private readonly providers = new Map<VirtualNumberProviderSlug, VirtualNumberProviderAdapter>();

  constructor(
    private readonly prisma: PrismaService,
    fleexa: FleexaVirtualNumberProvider,
  ) {
    this.providers.set('fleexa', fleexa);
  }

  async onModuleInit() {
    const active = await this.prisma.providerConfig.findFirst({
      where: { kind: ProviderKind.VIRTUAL_NUMBERS, active: true },
    });

    if (!active) {
      await this.prisma.providerConfig.upsert({
        where: { kind_provider: { kind: ProviderKind.VIRTUAL_NUMBERS, provider: 'fleexa' } },
        update: { active: true },
        create: { kind: ProviderKind.VIRTUAL_NUMBERS, provider: 'fleexa', active: true },
      });
      this.logger.log('Active virtual numbers provider set to fleexa');
    }
  }

  registeredSlugs(): VirtualNumberProviderSlug[] {
    return [...VIRTUAL_NUMBER_PROVIDER_SLUGS];
  }

  getProvider(slug: string): VirtualNumberProviderAdapter {
    const provider = this.providers.get(slug as VirtualNumberProviderSlug);
    if (!provider) {
      throw new BadRequestException(`Virtual numbers provider "${slug}" is not registered`);
    }
    return provider;
  }

  async getActiveSlug(): Promise<VirtualNumberProviderSlug> {
    const config = await this.prisma.providerConfig.findFirst({
      where: { kind: ProviderKind.VIRTUAL_NUMBERS, active: true },
    });
    const slug = (config?.provider || 'fleexa') as VirtualNumberProviderSlug;
    return this.providers.has(slug) ? slug : 'fleexa';
  }

  async getActiveProvider(): Promise<VirtualNumberProviderAdapter> {
    return this.getProvider(await this.getActiveSlug());
  }

  async setActiveProvider(slug: string) {
    if (!this.providers.has(slug as VirtualNumberProviderSlug)) {
      throw new BadRequestException(`Virtual numbers provider "${slug}" is not registered`);
    }

    const [, config] = await this.prisma.$transaction([
      this.prisma.providerConfig.updateMany({
        where: { kind: ProviderKind.VIRTUAL_NUMBERS },
        data: { active: false },
      }),
      this.prisma.providerConfig.upsert({
        where: { kind_provider: { kind: ProviderKind.VIRTUAL_NUMBERS, provider: slug } },
        update: { active: true },
        create: { kind: ProviderKind.VIRTUAL_NUMBERS, provider: slug, active: true },
      }),
    ]);

    this.logger.log(`Active virtual numbers provider switched to ${slug}`);
    return config;
  }

  async listConfigs() {
    return this.prisma.providerConfig.findMany({
      where: { kind: ProviderKind.VIRTUAL_NUMBERS },
      orderBy: { provider: 'asc' },
    });
  }
}
