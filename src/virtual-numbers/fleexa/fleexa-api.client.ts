import { BadRequestException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import {
  BuySmsOtpInput,
  FleexaApiResponse,
  FleexaBalanceResult,
  FleexaBuySmsResult,
  FleexaCheckSmsResult,
  FleexaCountry,
  FleexaSmsApp,
  FleexaSmsServerSlug,
} from './fleexa.types';

/** HTTP client for https://fleexa.com.ng/developer */
export class FleexaApiClient {
  private readonly logger = new Logger(FleexaApiClient.name);

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  private headers() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    params?: Record<string, string | number | undefined>,
    body?: Record<string, unknown>,
  ): Promise<FleexaApiResponse<T>> {
    try {
      const response = await axios.request<FleexaApiResponse<T>>({
        method,
        url: `${this.baseUrl.replace(/\/$/, '')}${path}`,
        headers: this.headers(),
        params,
        data: body,
        timeout: 30000,
      });
      return response.data;
    } catch (error) {
      const err = error as AxiosError<FleexaApiResponse<unknown>>;
      const status = err.response?.status;
      const payload = err.response?.data;
      const message =
        payload?.message ||
        (typeof payload === 'object' && payload && 'error' in payload
          ? String((payload as { error?: string }).error)
          : err.message);

      this.logger.warn(`Fleexa ${method} ${path} failed (${status}): ${message}`);

      if (status === 429) {
        throw new HttpException(
          'Fleexa rate limit exceeded — try again shortly',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw new BadRequestException(message || 'Fleexa API request failed');
    }
  }

  private ensureSuccess<T>(response: FleexaApiResponse<T>): T {
    if (!response.success || response.data === undefined) {
      throw new BadRequestException(
        response.message || response.error_code || 'Fleexa API returned an error',
      );
    }
    return response.data;
  }

  smsPath(server: FleexaSmsServerSlug, suffix: string): string {
    return `/${server}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
  }

  async getBalance(): Promise<number> {
    const data = this.ensureSuccess(
      await this.request<FleexaBalanceResult>('GET', '/balance'),
    );
    const balance =
      data.balance_ngn ?? data.available_balance ?? data.balance ?? 0;
    return Number(balance);
  }

  async listSmsCountries(server: FleexaSmsServerSlug) {
    const data = this.ensureSuccess(
      await this.request<Record<string, FleexaCountry>>(
        'GET',
        this.smsPath(server, '/countries'),
      ),
    );
    return Object.values(data);
  }

  async listSmsApps(
    server: FleexaSmsServerSlug,
    countryId: string,
    page?: number,
    limit?: number,
    search?: string,
  ) {
    const response = await this.request<FleexaSmsApp[]>(
      'GET',
      this.smsPath(server, '/apps'),
      {
        countryId,
        page,
        limit,
        search,
      },
    );
    return {
      apps: this.ensureSuccess(response),
      pagination: response.pagination,
      exchangeRate: response.exchange_rate,
    };
  }

  async getSmsPrices(server: FleexaSmsServerSlug, countryId: string) {
    if (server !== 'sms') {
      throw new BadRequestException('Price map is only available on SMS OTP 1');
    }
    return this.ensureSuccess(
      await this.request<Record<string, FleexaSmsApp>>(
        'GET',
        this.smsPath(server, '/prices'),
        { countryId },
      ),
    );
  }

  async buySms(server: FleexaSmsServerSlug, input: BuySmsOtpInput) {
    const body: Record<string, unknown> = {
      countryName: input.countryName,
      appName: input.appName,
      countryId: input.countryId,
      projectId: input.projectId,
    };
    if (input.operator) body.operator = input.operator;
    if (input.maxPrice !== undefined) body.maxPrice = input.maxPrice;

    return this.ensureSuccess<FleexaBuySmsResult>(
      await this.request<FleexaBuySmsResult>(
        'POST',
        this.smsPath(server, '/buy'),
        undefined,
        body,
      ),
    );
  }

  async checkSms(server: FleexaSmsServerSlug, requestId: string) {
    return this.ensureSuccess<FleexaCheckSmsResult>(
      await this.request<FleexaCheckSmsResult>(
        'GET',
        this.smsPath(server, `/check/${encodeURIComponent(requestId)}`),
      ),
    );
  }

  async cancelSms(server: FleexaSmsServerSlug, requestId: string) {
    return this.ensureSuccess(
      await this.request<{ success?: boolean }>(
        'POST',
        this.smsPath(server, '/cancel'),
        undefined,
        { requestId },
      ),
    );
  }
}

export function createFleexaClient(config: ConfigService): FleexaApiClient {
  const baseUrl =
    config.get<string>('FLEEXA_API_URL') || 'https://fleexa.com.ng/developer';
  const apiKey = config.get<string>('FLEEXA_API_KEY');
  if (!apiKey) {
    throw new Error('FLEEXA_API_KEY is not configured');
  }
  return new FleexaApiClient(baseUrl, apiKey);
}
