import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { otpEmailTemplate } from '../templates/otp-email.template';
import { welcomeEmailTemplate } from '../templates/welcome-email.template';
import { orderStatusEmailTemplate, OrderStatusData } from '../templates/order-status-email.template';

export interface SendOtpEmailDto {
  email: string;
  otp: string;
  userName?: string;
}

export interface SendWelcomeEmailDto {
  email: string;
  userName: string;
}

export interface SendOrderStatusEmailDto {
  email: string;
  orderData: OrderStatusData;
}

@Injectable()
export class ResendService {
  private readonly logger = new Logger(ResendService.name);
  private resend: Resend;
  private fromEmail: string;
  private fromName: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.fromEmail = this.configService.get<string>('FROM_EMAIL') || 'noreply@yourdomain.com';
    this.fromName = this.configService.get<string>('FROM_NAME') || 'Boost API';

    if (!apiKey) {
      this.logger.error('RESEND_API_KEY is not configured');
      throw new Error('Resend API key is required');
    }

    this.resend = new Resend(apiKey);
    this.logger.log('Resend service initialized successfully');
  }

  /**
   * Send OTP email for authentication
   */
  async sendOtpEmail(dto: SendOtpEmailDto): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      this.logger.debug(`Sending OTP email to: ${dto.email}`);

      const result = await this.resend.emails.send({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: [dto.email],
        subject: `Your OTP Code - ${this.fromName}`,
        html: otpEmailTemplate(dto.otp, dto.userName),
      });

      if (result.error) {
        this.logger.error(`Failed to send OTP email: ${result.error.message}`);
        return {
          success: false,
          error: result.error.message,
        };
      }

      this.logger.log(`OTP email sent successfully to ${dto.email}. Message ID: ${result.data?.id}`);
      return {
        success: true,
        messageId: result.data?.id,
      };
    } catch (error) {
      this.logger.error(`Error sending OTP email to ${dto.email}:`, error);
      return {
        success: false,
        error: error.message || 'Failed to send OTP email',
      };
    }
  }

  /**
   * Send welcome email for new users
   */
  async sendWelcomeEmail(dto: SendWelcomeEmailDto): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      this.logger.debug(`Sending welcome email to: ${dto.email}`);

      const result = await this.resend.emails.send({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: [dto.email],
        subject: `Welcome to ${this.fromName} - Get Started Today! 🚀`,
        html: welcomeEmailTemplate(dto.userName, dto.email),
      });

      if (result.error) {
        this.logger.error(`Failed to send welcome email: ${result.error.message}`);
        return {
          success: false,
          error: result.error.message,
        };
      }

      this.logger.log(`Welcome email sent successfully to ${dto.email}. Message ID: ${result.data?.id}`);
      return {
        success: true,
        messageId: result.data?.id,
      };
    } catch (error) {
      this.logger.error(`Error sending welcome email to ${dto.email}:`, error);
      return {
        success: false,
        error: error.message || 'Failed to send welcome email',
      };
    }
  }

  /**
   * Send order status update email
   */
  async sendOrderStatusEmail(dto: SendOrderStatusEmailDto): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      this.logger.debug(`Sending order status email to: ${dto.email} for order: ${dto.orderData.orderId}`);

      const statusSubjects = {
        pending: '⏳ Order Received',
        processing: '🔄 Order In Progress',
        completed: '✅ Order Completed',
        cancelled: '❌ Order Cancelled',
        partial: '⚠️ Order Partially Completed'
      };

      const subject = `${statusSubjects[dto.orderData.status]} - Order #${dto.orderData.orderId}`;

      const result = await this.resend.emails.send({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: [dto.email],
        subject,
        html: orderStatusEmailTemplate(dto.orderData),
      });

      if (result.error) {
        this.logger.error(`Failed to send order status email: ${result.error.message}`);
        return {
          success: false,
          error: result.error.message,
        };
      }

      this.logger.log(`Order status email sent successfully to ${dto.email}. Message ID: ${result.data?.id}`);
      return {
        success: true,
        messageId: result.data?.id,
      };
    } catch (error) {
      this.logger.error(`Error sending order status email to ${dto.email}:`, error);
      return {
        success: false,
        error: error.message || 'Failed to send order status email',
      };
    }
  }

  /**
   * Send custom email with HTML content
   */
  async sendCustomEmail(
    to: string | string[],
    subject: string,
    html: string,
    options?: {
      cc?: string[];
      bcc?: string[];
      replyTo?: string;
    }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      this.logger.debug(`Sending custom email to: ${Array.isArray(to) ? to.join(', ') : to}`);

      const result = await this.resend.emails.send({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        cc: options?.cc,
        bcc: options?.bcc,
        replyTo: options?.replyTo ? [options.replyTo] : undefined,
      });

      if (result.error) {
        this.logger.error(`Failed to send custom email: ${result.error.message}`);
        return {
          success: false,
          error: result.error.message,
        };
      }

      this.logger.log(`Custom email sent successfully. Message ID: ${result.data?.id}`);
      return {
        success: true,
        messageId: result.data?.id,
      };
    } catch (error) {
      this.logger.error(`Error sending custom email:`, error);
      return {
        success: false,
        error: error.message || 'Failed to send custom email',
      };
    }
  }

  /**
   * Generate a random OTP code
   */
  generateOtp(length: number = 6): string {
    const digits = '0123456789';
    let otp = '';
    
    for (let i = 0; i < length; i++) {
      otp += digits[Math.floor(Math.random() * digits.length)];
    }
    
    return otp;
  }

  /**
   * Validate email format
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Get service status
   */
  getStatus(): { isConfigured: boolean; fromEmail: string; fromName: string } {
    return {
      isConfigured: !!this.resend,
      fromEmail: this.fromEmail,
      fromName: this.fromName,
    };
  }
} 