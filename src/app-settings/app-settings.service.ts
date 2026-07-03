import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AppSettingsLinks {
  whatsappSupportLine: string | null;
  helpSupportUrl: string | null;
  aboutPageUrl: string | null;
  fundingFee: number;
  withdrawalFee: number;
}

export interface WalletFees {
  fundingFee: number;
  withdrawalFee: number;
}

export interface UpdateAppSettingsInput {
  whatsappSupportLine?: string | null;
  helpSupportUrl?: string | null;
  aboutPageUrl?: string | null;
  fundingFee?: number;
  withdrawalFee?: number;
  updatedBy?: string;
}

@Injectable()
export class AppSettingsService implements OnModuleInit {
  private readonly logger = new Logger(AppSettingsService.name);
  private static readonly SETTINGS_ID = 'default';

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.prisma.appSettings.upsert({
      where: { id: AppSettingsService.SETTINGS_ID },
      update: {},
      create: { id: AppSettingsService.SETTINGS_ID },
    });
    this.logger.log('App settings initialized');
  }

  async getPublicSettings(): Promise<AppSettingsLinks> {
    const settings = await this.getOrCreate();
    return this.toPublic(settings);
  }

  async getWalletFees(): Promise<WalletFees> {
    const settings = await this.getOrCreate();
    return {
      fundingFee: this.toNumber(settings.fundingFee),
      withdrawalFee: this.toNumber(settings.withdrawalFee),
    };
  }

  async getSettings() {
    return this.getOrCreate();
  }

  async updateSettings(input: UpdateAppSettingsInput) {
    const data: UpdateAppSettingsInput = {};
    if (input.whatsappSupportLine !== undefined) {
      data.whatsappSupportLine = input.whatsappSupportLine?.trim() || null;
    }
    if (input.helpSupportUrl !== undefined) {
      data.helpSupportUrl = input.helpSupportUrl?.trim() || null;
    }
    if (input.aboutPageUrl !== undefined) {
      data.aboutPageUrl = input.aboutPageUrl?.trim() || null;
    }
    if (input.fundingFee !== undefined) {
      data.fundingFee = Math.max(0, input.fundingFee);
    }
    if (input.withdrawalFee !== undefined) {
      data.withdrawalFee = Math.max(0, input.withdrawalFee);
    }
    if (input.updatedBy !== undefined) {
      data.updatedBy = input.updatedBy;
    }

    const updated = await this.prisma.appSettings.upsert({
      where: { id: AppSettingsService.SETTINGS_ID },
      update: data,
      create: {
        id: AppSettingsService.SETTINGS_ID,
        ...data,
      },
    });

    return updated;
  }

  private async getOrCreate() {
    return this.prisma.appSettings.upsert({
      where: { id: AppSettingsService.SETTINGS_ID },
      update: {},
      create: { id: AppSettingsService.SETTINGS_ID },
    });
  }

  private toNumber(value: { toString(): string } | number | null | undefined): number {
    if (value == null) return 0;
    return parseFloat(value.toString()) || 0;
  }

  private toPublic(settings: {
    whatsappSupportLine: string | null;
    helpSupportUrl: string | null;
    aboutPageUrl: string | null;
    fundingFee: { toString(): string };
    withdrawalFee: { toString(): string };
  }): AppSettingsLinks {
    return {
      whatsappSupportLine: settings.whatsappSupportLine,
      helpSupportUrl: settings.helpSupportUrl,
      aboutPageUrl: settings.aboutPageUrl,
      fundingFee: this.toNumber(settings.fundingFee),
      withdrawalFee: this.toNumber(settings.withdrawalFee),
    };
  }
}
