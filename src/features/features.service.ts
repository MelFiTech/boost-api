import { Injectable, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FeaturesGateway } from './features.gateway';

export const DEFAULT_FLAGS: { key: string; name: string; description: string; enabled: boolean }[] = [
  { key: 'smm', name: 'SMM Services', description: 'Social media boosting services', enabled: true },
  { key: 'bills', name: 'Bill Payments', description: 'Airtime, data, electricity, TV', enabled: true },
  { key: 'wallet_funding', name: 'Wallet Funding', description: 'Funding wallet via bank transfer', enabled: true },
];

@Injectable()
export class FeaturesService implements OnModuleInit {
  private readonly logger = new Logger(FeaturesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: FeaturesGateway,
  ) {}

  async onModuleInit() {
    this.gateway.snapshotProvider = () => this.getFlagMap();
    // Seed defaults without overwriting admin-set values
    for (const flag of DEFAULT_FLAGS) {
      await this.prisma.featureFlag.upsert({
        where: { key: flag.key },
        update: {},
        create: flag,
      });
    }
    this.logger.log('Feature flags initialized');
  }

  async getFlags() {
    return this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
  }

  async getFlagMap(): Promise<Record<string, boolean>> {
    const flags = await this.getFlags();
    return Object.fromEntries(flags.map((f) => [f.key, f.enabled]));
  }

  async isEnabled(key: string): Promise<boolean> {
    const flag = await this.prisma.featureFlag.findUnique({ where: { key } });
    return flag?.enabled ?? false;
  }

  async setFlag(key: string, enabled: boolean, updatedBy?: string) {
    const flag = await this.prisma.featureFlag.findUnique({ where: { key } });
    if (!flag) {
      throw new NotFoundException(`Feature flag "${key}" not found`);
    }
    const updated = await this.prisma.featureFlag.update({
      where: { key },
      data: { enabled, updatedBy },
    });
    this.gateway.broadcastFlag(key, enabled);
    return updated;
  }
}
