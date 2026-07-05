import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AppSettingsLinks {
  whatsappSupportLine: string | null;
  helpSupportUrl: string | null;
  aboutPageUrl: string | null;
  smmWebUrl: string | null;
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
  smmWebUrl?: string | null;
  fundingFee?: number;
  withdrawalFee?: number;
  smmMarkupPercent?: number;
  usdtExchangeRate?: number;
  updatedBy?: string;
}

export const DEFAULT_SMM_MARKUP_PERCENT = 10;
export const DEFAULT_USDT_EXCHANGE_RATE = 1500;

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

  /** Live SMM markup percentage applied to provider prices (default 10%). */
  async getSmmMarkupPercent(): Promise<number> {
    const settings = await this.getOrCreate();
    const value = this.toNumber(settings.smmMarkupPercent);
    return value > 0 ? value : DEFAULT_SMM_MARKUP_PERCENT;
  }

  /** Live USDT → NGN rate (default ₦1500). Managed from admin Pricing & Rates. */
  async getUsdtExchangeRate(): Promise<number> {
    const settings = await this.getOrCreate();
    const value = this.toNumber(settings.usdtExchangeRate);
    return value > 0 ? value : DEFAULT_USDT_EXCHANGE_RATE;
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
    if (input.smmWebUrl !== undefined) {
      const trimmed = input.smmWebUrl?.trim() || null;
      if (trimmed && !/^https?:\/\//i.test(trimmed)) {
        throw new BadRequestException('SMM web URL must start with http:// or https://');
      }
      data.smmWebUrl = trimmed;
    }
    if (input.fundingFee !== undefined) {
      data.fundingFee = Math.max(0, input.fundingFee);
    }
    if (input.withdrawalFee !== undefined) {
      data.withdrawalFee = Math.max(0, input.withdrawalFee);
    }
    if (input.smmMarkupPercent !== undefined) {
      // Clamp to a sane range so a fat-fingered admin can't zero out margins
      data.smmMarkupPercent = Math.min(1000, Math.max(0, input.smmMarkupPercent));
    }
    if (input.usdtExchangeRate !== undefined) {
      data.usdtExchangeRate = Math.min(100000, Math.max(1, input.usdtExchangeRate));
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
    smmWebUrl: string | null;
    fundingFee: { toString(): string };
    withdrawalFee: { toString(): string };
  }): AppSettingsLinks {
    return {
      whatsappSupportLine: settings.whatsappSupportLine,
      helpSupportUrl: settings.helpSupportUrl,
      aboutPageUrl: settings.aboutPageUrl,
      smmWebUrl: settings.smmWebUrl,
      fundingFee: this.toNumber(settings.fundingFee),
      withdrawalFee: this.toNumber(settings.withdrawalFee),
    };
  }
}
