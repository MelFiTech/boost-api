import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import axios from 'axios';

export interface SmmPanelOrderData {
  service: number;
  link: string;
  quantity: number;
  runs?: number;
  interval?: number;
  comments?: string;
  usernames?: string;
  hashtags?: string;
  hashtag?: string;
  username?: string;
  min?: number;
  max?: number;
  posts?: number;
  old_posts?: number;
  delay?: number;
  expiry?: string;
  answer_number?: string;
}

export interface SmmPanelOrderResponse {
  order?: number;
  error?: string;
  charge?: number;
  remains?: number;
  start_count?: number;
  status?: string;
  currency?: string;
}

/** Standard SMM panel API v2 client (SMMStone, SMM Panel King, etc.). */
export class SmmPanelApiClient {
  constructor(
    private readonly apiUrl: string,
    private readonly apiKey: string,
    private readonly logger: Logger,
    private readonly providerLabel: string,
  ) {}

  async call(data: Record<string, unknown>): Promise<unknown> {
    try {
      const postData = { key: this.apiKey, ...data };
      this.logger.debug(`${this.providerLabel} API Request:`, postData);

      const response = await axios.post(this.apiUrl, postData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/4.0 (compatible; MSIE 5.01; Windows NT 5.0)',
        },
        transformRequest: [
          (body) => {
            const params = new URLSearchParams();
            for (const [key, value] of Object.entries(body)) {
              params.append(key, String(value));
            }
            return params.toString();
          },
        ],
      });

      this.logger.debug(`${this.providerLabel} API Response:`, response.data);
      return response.data;
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      this.logger.error(
        `${this.providerLabel} API Error:`,
        err.response?.data || err.message,
      );
      throw new HttpException(
        `${this.providerLabel} API Error: ${err.response?.data?.error || err.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async getServices(): Promise<unknown[]> {
    const response = await this.call({ action: 'services' });
    return Array.isArray(response) ? response : [];
  }

  async getBalance(): Promise<unknown> {
    return this.call({ action: 'balance' });
  }

  async submitOrder(orderData: SmmPanelOrderData): Promise<SmmPanelOrderResponse> {
    this.logger.log(
      `Submitting order to ${this.providerLabel} - Service: ${orderData.service}, Link: ${orderData.link}, Quantity: ${orderData.quantity}`,
    );

    const response = (await this.call({ action: 'add', ...orderData })) as SmmPanelOrderResponse;
    if (response.error) {
      throw new HttpException(
        `${this.providerLabel} Order Error: ${response.error}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.log(`${this.providerLabel} order created - Order ID: ${response.order}`);
    return response;
  }

  async getOrderStatus(orderId: number): Promise<SmmPanelOrderResponse> {
    return (await this.call({ action: 'status', order: orderId })) as SmmPanelOrderResponse;
  }

  async getMultipleOrderStatus(orderIds: number[]): Promise<unknown> {
    return this.call({ action: 'status', orders: orderIds.join(',') });
  }
}
