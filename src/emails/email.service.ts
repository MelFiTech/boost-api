import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { isEmailDevMode } from './email-mode.util';
import {
  orderStatusEmailSubject,
  renderOrderStatusEmail,
  OrderStatusTemplateData,
} from './templates/order-status.template';
import {
  orderCompletionEmailSubject,
  renderOrderCompletionEmail,
  OrderCompletionTemplateData,
} from './templates/order-completion.template';
import {
  renderTxnSuccessEmail,
  txnSuccessEmailSubject,
  TxnSuccessTemplateData,
} from './templates/txn-success.template';
import {
  renderWithdrawalEmail,
  withdrawalEmailSubject,
  WithdrawalTemplateData,
} from './templates/withdrawal.template';
import {
  renderWalletTopUpEmail,
  walletTopUpEmailSubject,
  WalletTopUpTemplateData,
} from './templates/wallet-topup.template';
import {
  renderElectricityTokenEmail,
  electricityTokenEmailSubject,
  ElectricityTokenTemplateData,
} from './templates/electricity-token.template';
import { renderOtpEmail } from './templates/otp.template';
import { renderWelcomeEmail } from './templates/welcome.template';
import {
  kycVerificationEmailSubject,
  renderKycVerificationEmail,
  KycVerificationTemplateData,
} from './templates/kyc-verification.template';
import { renderCustomEmail } from './templates/custom.template';
import { NotificationPreferencesService } from '../services/notification-preferences.service';

export interface SendOtpEmailDto {
  email: string;
  otp: string;
  userName?: string;
}

export interface SendWelcomeEmailDto {
  email: string;
}

export interface SendKycVerificationEmailDto {
  email: string;
  status: 'approved' | 'declined';
  rejectionReason?: string;
  reviewedAt?: Date;
  userId?: string;
}

export interface SendOrderStatusEmailDto {
  email: string;
  orderData: OrderStatusTemplateData;
}

export interface SendOrderCompletionEmailDto {
  email: string;
  orderData: OrderCompletionTemplateData;
}

export interface SendTxnSuccessEmailDto {
  email: string;
  txnData: TxnSuccessTemplateData;
}

export interface SendWithdrawalEmailDto {
  email: string;
  withdrawalData: WithdrawalTemplateData;
}

export interface SendWalletTopUpEmailDto {
  email: string;
  topUpData: WalletTopUpTemplateData;
}

export interface SendElectricityTokenEmailDto {
  email: string;
  tokenData: ElectricityTokenTemplateData;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  skipped?: boolean;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly devMode: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly notificationPreferences: NotificationPreferencesService,
  ) {
    this.fromEmail =
      this.configService.get<string>('FROM_EMAIL') || 'noreply@boostlab.ng';
    this.fromName = this.configService.get<string>('FROM_NAME') || 'BoostLab';
    this.devMode = isEmailDevMode(this.configService);

    if (this.devMode) {
      this.logger.warn('Email dev mode — OTP stays 123456; outbound emails are not sent');
      return;
    }

    const host =
      this.configService.get<string>('ZEPTOMAIL_SMTP_HOST') || 'smtp.zeptomail.com';
    const port = parseInt(
      this.configService.get<string>('ZEPTOMAIL_SMTP_PORT') || '587',
      10,
    );
    const user =
      this.configService.get<string>('ZEPTOMAIL_SMTP_USER') || 'emailapikey';
    const pass = this.configService.get<string>('ZEPTOMAIL_SMTP_PASS');

    if (!pass) {
      this.logger.error('ZEPTOMAIL_SMTP_PASS is not configured');
      return;
    }

    const secure = port === 465;
    const transportOptions: SMTPTransport.Options = {
      host,
      port,
      secure,
      auth: { user, pass },
      ...(port === 587 ? { requireTLS: true } : {}),
    };

    this.transporter = nodemailer.createTransport(transportOptions);
    this.logger.log(`ZeptoMail SMTP ready (${host}:${port})`);
  }

  isDevMode(): boolean {
    return this.devMode;
  }

  isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  generateOtp(length = 6): string {
    let otp = '';
    for (let i = 0; i < length; i++) {
      otp += Math.floor(Math.random() * 10).toString();
    }
    return otp;
  }

  async sendOtpEmail(dto: SendOtpEmailDto): Promise<EmailSendResult> {
    return this.send({
      to: dto.email,
      subject: 'Your BoostLab login code',
      html: renderOtpEmail({
        otp: dto.otp,
        userName: dto.userName,
        expiryMinutes: parseInt(
          this.configService.get<string>('OTP_EXPIRY_MINUTES') || '10',
          10,
        ),
      }),
      logLabel: 'OTP',
      respectEmailPreference: false,
    });
  }

  async sendWelcomeEmail(
    dto: SendWelcomeEmailDto & { userId?: string },
  ): Promise<EmailSendResult> {
    return this.send({
      to: dto.email,
      subject: 'Welcome to BoostLab 🚀',
      html: renderWelcomeEmail({
        userEmail: dto.email,
      }),
      logLabel: 'Welcome',
      userId: dto.userId,
    });
  }

  async sendKycVerificationEmail(
    dto: SendKycVerificationEmailDto,
  ): Promise<EmailSendResult> {
    const payload: KycVerificationTemplateData = {
      userEmail: dto.email,
      status: dto.status,
      rejectionReason: dto.rejectionReason,
      reviewedAt: dto.reviewedAt,
    };

    return this.send({
      to: dto.email,
      subject: kycVerificationEmailSubject(payload),
      html: renderKycVerificationEmail(payload),
      logLabel: dto.status === 'approved' ? 'KYC approved' : 'KYC declined',
      userId: dto.userId,
    });
  }

  async sendOrderStatusEmail(
    dto: SendOrderStatusEmailDto & { userId?: string },
  ): Promise<EmailSendResult> {
    return this.send({
      to: dto.email,
      subject: orderStatusEmailSubject(dto.orderData),
      html: renderOrderStatusEmail(dto.orderData),
      logLabel: 'Order status',
      userId: dto.userId,
    });
  }

  async sendOrderCompletionEmail(
    dto: SendOrderCompletionEmailDto & { userId?: string },
  ): Promise<EmailSendResult> {
    return this.send({
      to: dto.email,
      subject: orderCompletionEmailSubject(dto.orderData),
      html: renderOrderCompletionEmail(dto.orderData),
      logLabel: 'Order completion',
      userId: dto.userId,
    });
  }

  async sendTxnSuccessEmail(
    dto: SendTxnSuccessEmailDto & { userId?: string },
  ): Promise<EmailSendResult> {
    return this.send({
      to: dto.email,
      subject: txnSuccessEmailSubject(dto.txnData),
      html: renderTxnSuccessEmail(dto.txnData),
      logLabel: 'Transaction success',
      userId: dto.userId,
    });
  }

  async sendWithdrawalEmail(
    dto: SendWithdrawalEmailDto & { userId?: string },
  ): Promise<EmailSendResult> {
    return this.send({
      to: dto.email,
      subject: withdrawalEmailSubject(dto.withdrawalData),
      html: renderWithdrawalEmail(dto.withdrawalData),
      logLabel: 'Withdrawal',
      userId: dto.userId,
    });
  }

  async sendWalletTopUpEmail(
    dto: SendWalletTopUpEmailDto & { userId?: string },
  ): Promise<EmailSendResult> {
    return this.send({
      to: dto.email,
      subject: walletTopUpEmailSubject(dto.topUpData),
      html: renderWalletTopUpEmail(dto.topUpData),
      logLabel: 'Wallet top up',
      userId: dto.userId,
    });
  }

  async sendElectricityTokenEmail(
    dto: SendElectricityTokenEmailDto & { userId?: string },
  ): Promise<EmailSendResult> {
    return this.send({
      to: dto.email,
      subject: electricityTokenEmailSubject(dto.tokenData),
      html: renderElectricityTokenEmail(dto.tokenData),
      logLabel: 'Electricity token',
      userId: dto.userId,
    });
  }

  async sendCustomEmail(
    to: string | string[],
    subject: string,
    htmlOrMessage: string,
    options?: { isHtml?: boolean; userId?: string },
  ): Promise<EmailSendResult> {
    const html = options?.isHtml
      ? htmlOrMessage
      : renderCustomEmail({
          title: subject,
          messageHtml: htmlOrMessage.replace(/\n/g, '<br/>'),
        });

    return this.send({
      to,
      subject,
      html,
      logLabel: 'Custom',
      userId: options?.userId,
    });
  }

  private async send(input: {
    to: string | string[];
    subject: string;
    html: string;
    logLabel: string;
    userId?: string;
    respectEmailPreference?: boolean;
  }): Promise<EmailSendResult> {
    const respectPreference = input.respectEmailPreference !== false;
    let recipients = Array.isArray(input.to) ? input.to : [input.to];

    if (respectPreference) {
      if (input.userId) {
        const allowed = await this.notificationPreferences.canReceiveEmail(input.userId);
        if (!allowed) {
          this.logger.log(
            `${input.logLabel} email skipped for user ${input.userId} (opted out)`,
          );
          return { success: true, skipped: true, messageId: 'email-opt-out' };
        }
      } else {
        recipients = await this.notificationPreferences.filterEmailEnabledAddresses(recipients);
        if (recipients.length === 0) {
          this.logger.log(`${input.logLabel} email skipped (all recipients opted out)`);
          return { success: true, skipped: true, messageId: 'email-opt-out' };
        }
      }
    }

    if (this.devMode) {
      this.logger.log(
        `[DEV] ${input.logLabel} email skipped → ${recipients.join(', ')} | ${input.subject}`,
      );
      return { success: true, skipped: true, messageId: 'dev-mode-skipped' };
    }

    if (!this.transporter) {
      return { success: false, error: 'Email transport is not configured' };
    }

    try {
      const info = await this.transporter.sendMail({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: recipients.join(', '),
        subject: input.subject,
        html: input.html,
      });

      this.logger.log(
        `${input.logLabel} email sent to ${recipients.join(', ')} (${info.messageId})`,
      );
      return { success: true, messageId: info.messageId };
    } catch (error) {
      this.logger.error(`${input.logLabel} email failed: ${error.message}`);
      return { success: false, error: error.message || 'Failed to send email' };
    }
  }

  getStatus() {
    return {
      provider: 'zeptomail',
      isConfigured: !!this.transporter || this.devMode,
      devMode: this.devMode,
      fromEmail: this.fromEmail,
      fromName: this.fromName,
    };
  }
}
