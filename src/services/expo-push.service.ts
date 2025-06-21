import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface ExpoMessage {
  to: string | string[];
  title: string;
  body: string;
  data?: { [key: string]: any };
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
  categoryId?: string;
  ttl?: number;
  expiration?: number;
  priority?: 'default' | 'normal' | 'high';
  subtitle?: string;
  mutableContent?: boolean;
}

export interface ExpoNotificationReceipt {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: any;
}

export interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: any;
}

@Injectable()
export class ExpoPushService {
  private readonly logger = new Logger(ExpoPushService.name);
  private readonly apiUrl = 'https://exp.host/--/api/v2/push';
  private readonly accessToken?: string;

  constructor(private readonly configService: ConfigService) {
    this.accessToken = this.configService.get<string>('EXPO_ACCESS_TOKEN');
  }

  /**
   * Validate if a token is a valid Expo push token
   */
  isValidExpoToken(token: string): boolean {
    return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
  }

  /**
   * Send notification to a single device
   */
  async sendToDevice(message: ExpoMessage): Promise<ExpoTicket> {
    try {
      if (!this.isValidExpoToken(message.to as string)) {
        throw new Error('Invalid Expo push token format');
      }

      const response = await this.sendNotifications([message]);
      return response.data[0];
    } catch (error) {
      this.logger.error(`Failed to send notification to device: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send notifications to multiple devices
   */
  async sendToMultipleDevices(messages: ExpoMessage[]): Promise<ExpoTicket[]> {
    try {
      // Validate all tokens
      const invalidTokens = messages.filter(msg => 
        !this.isValidExpoToken(Array.isArray(msg.to) ? msg.to[0] : msg.to)
      );

      if (invalidTokens.length > 0) {
        this.logger.warn(`Found ${invalidTokens.length} invalid Expo push tokens`);
      }

      // Filter out invalid tokens
      const validMessages = messages.filter(msg => 
        this.isValidExpoToken(Array.isArray(msg.to) ? msg.to[0] : msg.to)
      );

      if (validMessages.length === 0) {
        throw new Error('No valid Expo push tokens found');
      }

      const response = await this.sendNotifications(validMessages);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to send notifications to multiple devices: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send notification to multiple tokens (same message)
   */
  async sendToTokens(tokens: string[], message: Omit<ExpoMessage, 'to'>): Promise<ExpoTicket[]> {
    try {
      // Validate tokens
      const validTokens = tokens.filter(token => this.isValidExpoToken(token));
      
      if (validTokens.length === 0) {
        throw new Error('No valid Expo push tokens provided');
      }

      if (validTokens.length !== tokens.length) {
        this.logger.warn(`Filtered out ${tokens.length - validTokens.length} invalid tokens`);
      }

      // Chunk tokens (Expo API accepts up to 100 tokens per request)
      const chunks = this.chunkArray(validTokens, 100);
      const allTickets: ExpoTicket[] = [];

      for (const chunk of chunks) {
        const messages: ExpoMessage[] = chunk.map(token => ({
          ...message,
          to: token,
        }));

        const response = await this.sendNotifications(messages);
        allTickets.push(...response.data);
      }

      return allTickets;
    } catch (error) {
      this.logger.error(`Failed to send notifications to tokens: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get notification receipts for delivered notifications
   */
  async getReceipts(receiptIds: string[]): Promise<{ [id: string]: ExpoNotificationReceipt }> {
    try {
      const response = await axios.post(
        `${this.apiUrl}/getReceipts`,
        { ids: receiptIds },
        {
          headers: {
            'Content-Type': 'application/json',
            ...(this.accessToken && { 'Authorization': `Bearer ${this.accessToken}` }),
          },
        }
      );

      return response.data.data || {};
    } catch (error) {
      this.logger.error(`Failed to get notification receipts: ${error.message}`);
      throw error;
    }
  }

  /**
   * Private method to send notifications via Expo API
   */
  private async sendNotifications(messages: ExpoMessage[]): Promise<{ data: ExpoTicket[] }> {
    try {
      const response = await axios.post(
        `${this.apiUrl}/send`,
        messages,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            ...(this.accessToken && { 'Authorization': `Bearer ${this.accessToken}` }),
          },
        }
      );

      this.logger.log(`Sent ${messages.length} notifications via Expo Push Service`);
      return response.data;
    } catch (error) {
      if (error.response) {
        this.logger.error(`Expo API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      } else {
        this.logger.error(`Network error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Utility method to chunk arrays
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Create a standardized notification message
   */
  createMessage(options: {
    tokens: string[];
    title: string;
    body: string;
    data?: { [key: string]: any };
    sound?: 'default' | null;
    badge?: number;
    priority?: 'default' | 'normal' | 'high';
    channelId?: string;
    ttl?: number;
  }): ExpoMessage[] {
    return options.tokens.map(token => ({
      to: token,
      title: options.title,
      body: options.body,
      data: options.data || {},
      sound: options.sound ?? 'default',
      badge: options.badge,
      priority: options.priority || 'high',
      channelId: options.channelId || 'default',
      ttl: options.ttl || 2419200, // 4 weeks
    }));
  }

  /**
   * Check if Expo Push service is available
   */
  isAvailable(): boolean {
    return true; // Expo Push service is always available (no configuration required)
  }
} 