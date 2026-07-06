import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  isSmmstoneInsufficientBalanceError,
  isSmmstoneLowBalance,
  parseSmmstoneBalance,
} from '../smmstone/smmstone-balance.util';
import { ensureServiceProvider, syncProviderCatalog } from '../smm/smm-catalog-sync.util';
import {
  SmmPanelApiClient,
  SmmPanelOrderData,
  SmmPanelOrderResponse,
} from '../smm/smm-panel-api.client';
import { SmmBalanceStatus, SmmProviderAdapter } from '../smm/smm-provider.types';

@Injectable()
export class SmmpanelkingService implements SmmProviderAdapter {
  readonly slug = 'smmpanelking' as const;
  readonly displayName = 'SMM Panel King';

  private readonly logger = new Logger(SmmpanelkingService.name);
  private readonly client: SmmPanelApiClient;
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.apiUrl =
      this.configService.get<string>('SMMPANELKING_API_URL') ||
      'https://smmpanelking.com/api/v2';
    this.apiKey = this.configService.get<string>('SMMPANELKING_API_KEY') || '';

    if (!this.apiKey) {
      this.logger.warn('SMM Panel King API key not configured');
    }

    this.client = new SmmPanelApiClient(
      this.apiUrl,
      this.apiKey,
      this.logger,
      this.displayName,
    );
  }

  async getBalance(): Promise<unknown> {
    return this.client.getBalance();
  }

  async getServices(): Promise<unknown[]> {
    return this.client.getServices();
  }

  async getBalanceStatus(threshold = 10): Promise<SmmBalanceStatus> {
    const raw = await this.getBalance();
    const balance = parseSmmstoneBalance(raw);
    const currency =
      typeof raw === 'object' && raw && 'currency' in raw
        ? String((raw as { currency?: string }).currency || 'USD')
        : 'USD';

    return {
      balance,
      currency,
      lowBalance: isSmmstoneLowBalance(balance, threshold),
      threshold,
      raw,
    };
  }

  async submitOrder(orderData: SmmPanelOrderData): Promise<SmmPanelOrderResponse> {
    return this.client.submitOrder(orderData);
  }

  async getOrderStatus(orderId: number): Promise<SmmPanelOrderResponse> {
    return this.client.getOrderStatus(orderId);
  }

  async getMultipleOrderStatus(orderIds: number[]): Promise<unknown> {
    return this.client.getMultipleOrderStatus(orderIds);
  }

  async fetchAndStoreServices(): Promise<void> {
    this.logger.log('Fetching services from SMM Panel King…');
    const services = (await this.client.getServices()) as Array<Record<string, unknown>>;

    if (!services.length) {
      this.logger.warn('No services returned from SMM Panel King API');
      return;
    }

    const provider = await ensureServiceProvider(
      this.prisma,
      this.displayName,
      this.slug,
      this.apiUrl,
      this.apiKey,
    );

    await syncProviderCatalog(this.prisma, this.logger, provider, services);
    this.logger.log('SMM Panel King services synchronized');
  }
}
