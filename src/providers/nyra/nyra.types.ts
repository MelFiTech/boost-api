export type NyraFundingRail = 'Safe_Haven' | 'Flutterwave';

export const NYRA_FUNDING_RAILS: NyraFundingRail[] = ['Flutterwave', 'Safe_Haven'];

export interface NyraFlutterwaveMeta {
  email: string;
  firstname: string;
  lastname: string;
  phonenumber?: string;
  bvn?: string;
  narration?: string;
}

export interface NyraFundingAccountMeta {
  customer_name?: string;
  customer_email?: string;
  name_on_account?: string;
  flutterwave?: NyraFlutterwaveMeta;
}

export interface NyraOAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface NyraCreateFundingAccountRequest {
  external_reference: string;
  account_kind: 'dynamic';
  amount: number;
  expiresIn?: number;
  provider: NyraFundingRail;
  meta?: NyraFundingAccountMeta;
}

export interface NyraFundingAccount {
  id: string;
  account_number: string;
  account_name: string;
  bank_name: string;
  bank_code?: string;
  amount: number;
  status: string;
  external_reference: string;
  expiresIn?: number;
  expiry_date?: string;
  funding_account_kind?: string;
  provider?: string;
  meta?: Record<string, unknown>;
}

export interface NyraBvnBasicIdentity {
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  date_of_birth?: string;
  phone_number?: string;
}

export interface NyraBvnAdvancedIdentity extends NyraBvnBasicIdentity {
  gender?: string;
  marital_status?: string;
  phone_number1?: string;
  phone_number2?: string;
  email?: string;
  residential_address?: string;
  state_of_residence?: string;
  lga_of_residence?: string;
  enrollment_bank?: string;
  enrollment_branch?: string;
  level_of_account?: string;
  state_of_origin?: string;
  lga_of_origin?: string;
  nationality?: string;
  name_on_card?: string;
  title?: string;
  registration_date?: string;
  watch_listed?: string | boolean;
  base64_image?: string;
}

export interface NyraNinIdentity {
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  gender?: string;
  date_of_birth?: string;
  phone_number?: string;
  email?: string;
  employment_status?: string;
  marital_status?: string;
  photo?: string;
}

export interface NyraApiResponse<T> {
  success?: boolean;
  status?: string;
  message?: string;
  data: T;
}

export interface NyraTemporaryAccountFundedPayload {
  credit_account_number?: string;
  credit_account_name?: string;
  amount_received?: number;
  amount_settled?: number;
  fee_deducted?: number;
  charge?: number;
  currency?: string;
  status?: string;
  reference?: string;
  external_reference?: string;
  sessionId?: string;
  sender_name?: string;
  sender_account_number?: string;
  sender_bank?: string;
  business_id?: string;
  wallet_id?: string | null;
  timestamp?: string;
  paid_at?: string;
  meta?: Record<string, unknown>;
}

export interface NyraWebhookPayload {
  event: string;
  data: NyraTemporaryAccountFundedPayload;
}

// ---------- Business transfers (withdrawals) ----------

export interface NyraTransferBank {
  name: string;
  code: string;
  slug?: string;
}

export interface NyraFloatWallet {
  account_number: string;
  account_name?: string;
  bank_name?: string;
  is_business_float?: boolean;
  available_balance?: number;
  [key: string]: unknown;
}

/** Master (parent) business wallet — pool for transfers, bills, KYC fees. */
export interface NyraBusinessWalletBalance {
  businessId: string;
  businessName: string;
  balance: number;
  available_balance: number;
  unsettled_balance: number;
  settlement_enabled: boolean;
}

export interface NyraTransferNameEnquiryResult {
  account: {
    number: string;
    name: string;
  };
  sessionId: string;
  bank_name?: string;
}

export interface NyraTransferBeneficiary {
  account_number: string;
  bank_code: string;
  account_name: string;
  bank_name?: string;
  enquiry_session_id?: string;
}

export interface NyraInitiateTransferRequest {
  source_account_number: string;
  amount: number;
  description?: string;
  sender_name?: string;
  beneficiary: NyraTransferBeneficiary;
  asserted_business_id?: string;
  client_request_id?: string;
  client_timestamp?: string;
  client_nonce?: string;
  client_signature?: string;
}

export interface NyraTransferResult {
  transaction_id: string;
  transaction_type?: string;
  transaction_category?: string;
  transaction_status: string;
  amount: number;
  charge?: number;
  balance_before?: number;
  balance_after?: number;
  transaction_reference?: string;
  description?: string;
  meta?: Record<string, unknown>;
}

export interface NyraTransferWebhookPayload {
  reference?: string;
  sessionId?: string;
  transaction_id?: string;
  amount?: number;
  fee_deducted?: number;
  charge?: number;
  sender_account_number?: string;
  sender_name?: string;
  credit_account_name?: string;
  status?: string;
  business_id?: string;
  narration?: string;
  client_request_id?: string;
  [key: string]: unknown;
}
