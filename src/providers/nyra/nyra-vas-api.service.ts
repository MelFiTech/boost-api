import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import {
  NyraVasApiResponse,
  NyraVasBiller,
  NyraVasDataPlan,
  NyraVasPackageItem,
  NyraVasPayResult,
  NyraVasService,
  NyraVasValidateElectricityResult,
  NyraVasValidateTvResult,
} from './nyra-vas.types';

@Injectable()
export class NyraVasApiService {
  private readonly logger = new Logger(NyraVasApiService.name);
  private readonly http: AxiosInstance;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(private readonly configService: ConfigService) {
    const baseURL =
      this.configService.get<string>('NYRA_API_BASE_URL') ||
      this.configService.get<string>('NYRA_BASE_URL') ||
      'https://api.usemelon.co/api/v1';

    this.clientId = this.configService.get<string>('NYRA_CLIENT_ID') || '';
    this.clientSecret = this.configService.get<string>('NYRA_CLIENT_SECRET') || '';

    if (!this.clientId || !this.clientSecret) {
      this.logger.warn('NYRA_CLIENT_ID or NYRA_CLIENT_SECRET is not configured for VAS');
    }

    this.http = axios.create({
      baseURL,
      timeout: 60000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private vasHeaders() {
    return {
      'x-client-id': this.clientId,
      Authorization: `Bearer ${this.clientSecret}`,
    };
  }

  private async request<T>(method: 'get' | 'post', path: string, body?: unknown): Promise<T> {
    const response = await this.http.request<NyraVasApiResponse<T>>({
      method,
      url: path,
      data: body,
      headers: this.vasHeaders(),
    });

    const payload = response.data;
    if (payload.success === false) {
      throw new Error(payload.message || 'Nyra VAS request failed');
    }

    return (payload.data ?? payload) as T;
  }

  // Nyra returns service/biller names under `service` / `biller`, and package
  // lists nested under an arbitrary wrapper key (e.g. { payment_type_id: { items } }
  // for electricity, { pkg_id: { items } } for TV). We normalize everything here
  // so the rest of the app sees a stable { id, name } / flat item[] shape.
  private extractItems(data: unknown): NyraVasPackageItem[] {
    if (Array.isArray(data)) {
      return data as NyraVasPackageItem[];
    }
    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>;
      if (Array.isArray(record.items)) {
        return record.items as NyraVasPackageItem[];
      }
      for (const value of Object.values(record)) {
        if (value && typeof value === 'object' && Array.isArray((value as any).items)) {
          return (value as any).items as NyraVasPackageItem[];
        }
      }
    }
    return [];
  }

  async listServices(): Promise<NyraVasService[]> {
    const raw = await this.request<Record<string, any>[]>('get', '/business/vas/services');
    return (raw ?? []).map((service) => ({
      ...service,
      id: service.id,
      name: (service.service ?? service.name ?? '').toString().trim(),
      category: service.category,
    }));
  }

  async listBillers(serviceId: string): Promise<NyraVasBiller[]> {
    const raw = await this.request<Record<string, any>[]>(
      'get',
      `/business/vas/${serviceId}/billers`,
    );
    return (raw ?? []).map((biller) => ({
      ...biller,
      id: biller.id,
      name: (biller.biller ?? biller.name ?? '').toString().trim(),
      category: biller.category,
    }));
  }

  listDataPlans(network: string) {
    return this.listDataPlansByNetwork(network);
  }

  async listDataPlansByNetwork(network: string) {
    const response = await this.http.get<NyraVasApiResponse<NyraVasDataPlan[]>>(
      '/business/vas/data-plans',
      { params: { network }, headers: this.vasHeaders() },
    );
    if (response.data.success === false) {
      throw new Error(response.data.message || 'Failed to list data plans');
    }
    return response.data.data ?? [];
  }

  async listTvItems(billerId: string): Promise<NyraVasPackageItem[]> {
    const data = await this.request<unknown>(
      'get',
      `/business/vas/tv/items?biller_id=${encodeURIComponent(billerId)}`,
    );
    return this.extractItems(data);
  }

  async listElectricityItems(billerId: string): Promise<NyraVasPackageItem[]> {
    const data = await this.request<unknown>(
      'get',
      `/business/vas/electricity/items?biller_id=${encodeURIComponent(billerId)}`,
    );
    return this.extractItems(data);
  }

  validateTv(smartCardNumber: string, packageId: string) {
    return this.request<NyraVasValidateTvResult>('post', '/business/vas/tv/validate', {
      smart_card_number: smartCardNumber,
      package_id: packageId,
    });
  }

  validateElectricity(meterNumber: string, packageId: string) {
    return this.request<NyraVasValidateElectricityResult>(
      'post',
      '/business/vas/electricity/validate',
      {
        meter_number: meterNumber,
        package_id: packageId,
      },
    );
  }

  purchaseAirtime(phoneNumber: string, network: string, amount: number) {
    return this.request<NyraVasPayResult>('post', '/business/vas/airtime/purchase', {
      phone_number: phoneNumber,
      network: network.toUpperCase(),
      amount: Math.round(amount),
    });
  }

  purchaseData(phoneNumber: string, bundleId: string, amount: number) {
    return this.request<NyraVasPayResult>('post', '/business/vas/data/purchase', {
      phone_number: phoneNumber,
      bundle_id: bundleId,
      amount: Math.round(amount),
    });
  }

  payTv(smartCardNumber: string, packageId: string, amount: number) {
    return this.request<NyraVasPayResult>('post', '/business/vas/tv/pay', {
      smart_card_number: smartCardNumber,
      package_id: packageId,
      amount: Math.round(amount),
    });
  }

  payElectricity(meterNumber: string, packageId: string, amount: number) {
    return this.request<NyraVasPayResult>('post', '/business/vas/electricity/pay', {
      meter_number: meterNumber,
      package_id: packageId,
      amount: Math.round(amount),
    });
  }

  getTransaction(id: string) {
    return this.request<Record<string, unknown>>('get', `/business/transactions/${id}`);
  }
}
