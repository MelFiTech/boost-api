import { Injectable, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FeaturesGateway } from './features.gateway';

export const DEFAULT_FLAGS: { key: string; name: string; description: string; enabled: boolean }[] = [
  {
    key: 'smm',
    name: 'SMM (Mobile)',
    description:
      'Mobile app only — hides SMM in the app. Does not affect the hosted SMM web flow, catalog, or order APIs.',
    enabled: true,
  },
  { key: 'bills', name: 'Bill Payments', description: 'Airtime, data, electricity, TV', enabled: true },
  { key: 'wallet_funding', name: 'Wallet Funding', description: 'Funding wallet via bank transfer', enabled: true },
  { key: 'virtual_numbers', name: 'Virtual Numbers', description: 'SMS OTP virtual numbers via Fleexa', enabled: false },
];

/** Flags that only gate the mobile app UI — never block web or backend APIs. */
export const MOBILE_ONLY_FEATURE_KEYS = new Set(['smm']);

@Injectable()
export class FeaturesService implements OnModuleInit {
  private readonly logger = new Logger(FeaturesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: FeaturesGateway,
  ) {}

  async onModuleInit() {
    this.gateway.snapshotProvider = () => this.getFlagMap();
    // Seed defaults; refresh name/description without overwriting admin-set enabled state
    for (const flag of DEFAULT_FLAGS) {
      await this.prisma.featureFlag.upsert({
        where: { key: flag.key },
        update: { name: flag.name, description: flag.description },
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
    // Mobile-only flags (e.g. `smm`) must never gate backend APIs or the web flow.
    // The mobile app reads the real value from getFlagMap() / WebSocket.
    if (MOBILE_ONLY_FEATURE_KEYS.has(key)) {
      return true;
    }
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
