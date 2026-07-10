export type FleexaSmsServerSlug = 'sms' | 'sms2' | 'sms3';

export const FLEEXA_SMS_SERVERS: FleexaSmsServerSlug[] = ['sms', 'sms2', 'sms3'];

export interface FleexaApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error_code?: string;
  errors?: Array<{ field?: string; message?: string }>;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  exchange_rate?: number;
}

export interface FleexaCountry {
  id: number | string;
  title: string;
  code?: string;
  prefix?: string;
}

export interface FleexaSmsApp {
  id: number | string;
  name: string;
  qty?: number;
  quantity?: number;
  price_ngn?: string;
  api_discount_percent?: number;
  project_id?: number | string;
}

export interface FleexaBuySmsResult {
  requestId: string;
  number: string;
  service?: string;
  country?: string;
  amount_paid: number;
  status: string;
}

export interface FleexaCheckSmsResult {
  code: 'WAITING' | 'RECEIVED' | 'CANCELED' | 'EXPIRED' | string;
  sms?: string;
  message?: string;
  code_received?: string;
}

export interface FleexaBalanceResult {
  balance?: number;
  balance_ngn?: number;
  available_balance?: number;
  [key: string]: unknown;
}

export interface BuySmsOtpInput {
  countryName: string;
  appName: string;
  countryId: string;
  projectId: string;
  operator?: string;
  maxPrice?: number;
}
