import { SmmPanelOrderData, SmmPanelOrderResponse } from './smm-panel-api.client';

export const SMM_PROVIDER_SLUGS = ['smmstone', 'smmpanelking'] as const;
export type SmmProviderSlug = (typeof SMM_PROVIDER_SLUGS)[number];

export interface SmmBalanceStatus {
  balance: number | null;
  currency: string;
  lowBalance: boolean;
  threshold: number;
  raw: unknown;
}

export interface SmmProviderAdapter {
  readonly slug: SmmProviderSlug;
  readonly displayName: string;
  getServices(): Promise<unknown[]>;
  getBalance(): Promise<unknown>;
  getBalanceStatus(threshold?: number): Promise<SmmBalanceStatus>;
  submitOrder(orderData: SmmPanelOrderData): Promise<SmmPanelOrderResponse>;
  getOrderStatus(orderId: number): Promise<SmmPanelOrderResponse>;
  getMultipleOrderStatus(orderIds: number[]): Promise<unknown>;
  fetchAndStoreServices(): Promise<void>;
}
