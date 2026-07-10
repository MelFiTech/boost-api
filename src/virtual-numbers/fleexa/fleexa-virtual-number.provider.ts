import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FleexaApiClient, createFleexaClient } from './fleexa-api.client';
import { VirtualNumberProviderAdapter } from '../virtual-number.provider.types';

@Injectable()
export class FleexaVirtualNumberProvider implements VirtualNumberProviderAdapter {
  readonly slug = 'fleexa' as const;
  readonly displayName = 'Fleexa';
  private client: FleexaApiClient | null = null;

  constructor(private readonly config: ConfigService) {}

  getClient(): FleexaApiClient {
    if (!this.client) {
      this.client = createFleexaClient(this.config);
    }
    return this.client;
  }

  async getBalance(): Promise<number> {
    return this.getClient().getBalance();
  }

  isConfigured(): boolean {
    return !!this.config.get<string>('FLEEXA_API_KEY');
  }
}
