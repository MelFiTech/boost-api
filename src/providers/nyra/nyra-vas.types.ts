export interface NyraVasApiResponse<T = unknown> {
  success?: boolean;
  status?: string;
  message?: string;
  data?: T;
}

export interface NyraVasService {
  id: string;
  name: string;
  category?: string;
  [key: string]: unknown;
}

export interface NyraVasBiller {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface NyraVasDataPlan {
  bundle_id: string;
  amount: string;
  data_bundle: string;
  validity: string;
  network?: string;
}

export interface NyraVasPackageItem {
  id: string;
  label?: string;
  name?: string;
  amount: string | number;
  [key: string]: unknown;
}

export interface NyraVasPayResult {
  reference: string;
  amount: number;
  status: string;
}

export interface NyraVasValidateTvResult {
  customer_name?: string;
  customer_info?: string;
  [key: string]: unknown;
}

export interface NyraVasValidateElectricityResult {
  customer_name?: string;
  customer_info?: string;
  outstanding?: number;
  amount?: number;
  [key: string]: unknown;
}

export interface NyraElectricityCompletedPayload {
  reference?: string;
  transaction_id: string;
  meter_number?: string;
  amount?: number;
  package_id?: string;
  token?: string;
  number_of_units?: string;
  is_token?: boolean;
  provider?: string;
  status: string;
}

export interface NyraVasWebhookPayload {
  event: string;
  data: Record<string, unknown>;
}
