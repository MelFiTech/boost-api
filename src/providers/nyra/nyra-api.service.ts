import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import {
  NyraApiResponse,
  NyraBvnAdvancedIdentity,
  NyraBvnBasicIdentity,
  NyraBusinessWalletBalance,
  NyraCreateFundingAccountRequest,
  NyraFloatWallet,
  NyraFundingAccount,
  NyraInitiateTransferRequest,
  NyraNinIdentity,
  NyraOAuthTokenResponse,
  NyraTransferBank,
  NyraTransferNameEnquiryResult,
  NyraTransferResult,
} from './nyra.types';

@Injectable()
export class NyraApiService {
  private readonly logger = new Logger(NyraApiService.name);
  private readonly http: AxiosInstance;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly webhookSecret: string;
  private readonly businessId: string;

  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private readonly configService: ConfigService) {
    const baseURL =
      this.configService.get<string>('NYRA_API_BASE_URL') ||
      this.configService.get<string>('NYRA_BASE_URL') ||
      'https://api.usemelon.co/api/v1';

    this.clientId = this.configService.get<string>('NYRA_CLIENT_ID') || '';
    this.clientSecret = this.configService.get<string>('NYRA_CLIENT_SECRET') || '';
    this.webhookSecret = this.configService.get<string>('NYRA_WEBHOOK_SECRET') || '';
    this.businessId = this.configService.get<string>('NYRA_BUSINESS_ID') || '';

    if (!this.clientId || !this.clientSecret) {
      this.logger.warn('NYRA_CLIENT_ID or NYRA_CLIENT_SECRET is not configured');
    }

    this.http = axios.create({
      baseURL,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /** Nyra external_reference must be 10–26 characters. */
  static isValidExternalReference(reference: string): boolean {
    return reference.length >= 10 && reference.length <= 26;
  }

  async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.accessToken && now < this.tokenExpiresAt - 60_000) {
      return this.accessToken;
    }

    const response = await this.http.post<NyraOAuthTokenResponse>('/oauth/token', {
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    this.accessToken = response.data.access_token;
    this.tokenExpiresAt = now + response.data.expires_in * 1000;
    return this.accessToken;
  }

  private async authedRequest<T>(method: 'get' | 'post', path: string, body?: unknown): Promise<T> {
    const token = await this.getAccessToken();
    const response = await this.http.request<T>({
      method,
      url: path,
      data: body,
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }

  /**
   * Customer KYC + business transfers use API client credentials:
   * x-client-id + Authorization: Bearer <client_secret>.
   */
  private async clientCredentialsRequest<T>(
    method: 'get' | 'post',
    path: string,
    body?: unknown,
  ): Promise<T> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('NYRA_CLIENT_ID or NYRA_CLIENT_SECRET is not configured');
    }

    const response = await this.http.request<T>({
      method,
      url: path,
      data: body,
      headers: {
        'x-client-id': this.clientId,
        Authorization: `Bearer ${this.clientSecret}`,
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  }

  async verifyBvnBasic(bvn: string): Promise<NyraBvnBasicIdentity> {
    const response = await this.clientCredentialsRequest<NyraApiResponse<NyraBvnBasicIdentity>>(
      'post',
      `/business/identities/bvn?bvn=${encodeURIComponent(bvn)}`,
    );

    if (!response.success && response.status !== 'success') {
      throw new Error(response.message || 'BVN verification failed');
    }
    return response.data;
  }

  async verifyBvnAdvanced(bvn: string): Promise<NyraBvnAdvancedIdentity> {
    const response = await this.clientCredentialsRequest<NyraApiResponse<NyraBvnAdvancedIdentity>>(
      'post',
      `/business/identities/bvn/advance?bvn=${encodeURIComponent(bvn)}`,
    );

    if (!response.success && response.status !== 'success') {
      throw new Error(response.message || 'Advanced BVN verification failed');
    }
    return response.data;
  }

  async verifyNin(nin: string): Promise<NyraNinIdentity> {
    const response = await this.clientCredentialsRequest<NyraApiResponse<NyraNinIdentity>>(
      'get',
      `/business/identities/nin?nin=${encodeURIComponent(nin)}`,
    );

    if (!response.success && response.status !== 'success') {
      throw new Error(response.message || 'NIN verification failed');
    }
    return response.data;
  }

  async createDynamicFundingAccount(
    request: NyraCreateFundingAccountRequest,
  ): Promise<NyraFundingAccount> {
    if (!NyraApiService.isValidExternalReference(request.external_reference)) {
      throw new Error(
        `Nyra external_reference must be 10–26 characters (got ${request.external_reference.length})`,
      );
    }

    this.logger.log(
      `Creating Nyra dynamic VA: ref=${request.external_reference}, amount=${request.amount}, provider=${request.provider}`,
    );

    const response = await this.clientCredentialsRequest<NyraApiResponse<NyraFundingAccount>>(
      'post',
      '/business/wallets/funding-accounts',
      request,
    );

    if (response.status !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to create Nyra funding account');
    }

    return response.data;
  }

  async getFundingAccount(id: string): Promise<NyraFundingAccount> {
    const response = await this.clientCredentialsRequest<NyraApiResponse<NyraFundingAccount>>(
      'get',
      `/business/wallets/funding-accounts/${id}`,
    );
    return response.data;
  }

  async getFundingAccountStatus(sessionId: string): Promise<NyraFundingAccount> {
    const response = await this.clientCredentialsRequest<NyraApiResponse<NyraFundingAccount>>(
      'get',
      `/business/wallets/funding-accounts/${sessionId}/status`,
    );
    return response.data;
  }

  // ---------- Business transfers ----------

  async getBusinessWalletBalance(): Promise<NyraBusinessWalletBalance> {
    const response = await this.clientCredentialsRequest<
      NyraApiResponse<NyraBusinessWalletBalance>
    >('get', '/business/wallets/wallet_balance');

    if (!response.success && response.status !== 'success') {
      throw new Error(response.message || 'Failed to fetch Nyra business wallet balance');
    }
    if (!response.data) {
      throw new Error('Nyra wallet balance response missing data');
    }
    return response.data;
  }

  async listFloatWallets(): Promise<NyraFloatWallet[]> {
    const response = await this.clientCredentialsRequest<NyraApiResponse<NyraFloatWallet[]>>(
      'get',
      '/business/wallets/float',
    );
    if (!response.success && response.status !== 'success') {
      throw new Error(response.message || 'Failed to list Nyra float wallets');
    }
    return response.data || [];
  }

  async listTransferBanks(): Promise<NyraTransferBank[]> {
    const response = await this.clientCredentialsRequest<NyraApiResponse<NyraTransferBank[]>>(
      'get',
      '/business/transfers/bank/list',
    );
    if (!response.success && response.status !== 'success') {
      throw new Error(response.message || 'Failed to list transfer banks');
    }
    return (response.data || [])
      .map((bank) => {
        const raw = bank as NyraTransferBank & { bank_name?: string; bank_code?: string };
        return {
          name: String(raw.bank_name ?? raw.name ?? '').trim(),
          code: String(raw.bank_code ?? raw.code ?? '').trim(),
          slug: raw.slug,
        };
      })
      .filter((bank) => bank.name && bank.code);
  }

  async transferNameEnquiry(
    accountNumber: string,
    bankCode: string,
  ): Promise<NyraTransferNameEnquiryResult> {
    const response = await this.clientCredentialsRequest<
      NyraApiResponse<NyraTransferNameEnquiryResult>
    >(
      'post',
      `/business/transfers/name-enquiry?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
    );

    if (!response.success && response.status !== 'success') {
      throw new Error(response.message || 'Name enquiry failed');
    }
    if (!response.data?.account?.name) {
      throw new Error('Name enquiry returned no account name');
    }
    return response.data;
  }

  async initiateTransfer(request: NyraInitiateTransferRequest): Promise<NyraTransferResult> {
    const body: NyraInitiateTransferRequest = {
      ...request,
      asserted_business_id: request.asserted_business_id || this.businessId || undefined,
      client_timestamp: request.client_timestamp || new Date().toISOString(),
      client_nonce: request.client_nonce || randomUUID(),
    };

    const response = await this.clientCredentialsRequest<NyraApiResponse<NyraTransferResult>>(
      'post',
      '/business/transfers',
      body,
    );

    if (!response.success && response.status !== 'success') {
      throw new Error(response.message || 'Transfer initiation failed');
    }
    if (!response.data?.transaction_id) {
      throw new Error('Transfer response missing transaction_id');
    }
    return response.data;
  }

  async getBusinessTransaction(transactionId: string): Promise<NyraTransferResult> {
    const response = await this.clientCredentialsRequest<NyraApiResponse<NyraTransferResult>>(
      'get',
      `/business/transactions/${encodeURIComponent(transactionId)}`,
    );
    if (!response.success && response.status !== 'success') {
      throw new Error(response.message || 'Failed to fetch transaction status');
    }
    return response.data;
  }

  verifyWebhookSignature(payload: unknown, signatureHeader?: string): boolean {
    if (!this.webhookSecret) {
      this.logger.warn('NYRA_WEBHOOK_SECRET not set — skipping webhook signature verification');
      return true;
    }

    if (!signatureHeader) {
      return false;
    }

    const expected = createHmac('sha256', this.webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
    } catch {
      return false;
    }
  }
}
