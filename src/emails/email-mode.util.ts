import { ConfigService } from '@nestjs/config';

/** Dev: fixed OTP 123456, emails logged not sent. Prod: real OTP + ZeptoMail. */
export function isEmailDevMode(configService: ConfigService): boolean {
  const mode = configService.get<string>('EMAIL_MODE')?.toLowerCase();
  if (mode === 'prod' || mode === 'production') return false;
  if (mode === 'dev' || mode === 'development') return true;
  return configService.get<string>('NODE_ENV') !== 'production';
}

/**
 * Local/dev OTP bypass (123456). Independent of EMAIL_MODE so you can test
 * real ZeptoMail delivery while still using a fixed OTP locally.
 */
export function isOtpDevMode(configService: ConfigService): boolean {
  const override = configService.get<string>('OTP_DEV_MODE')?.toLowerCase();
  if (override === 'true' || override === '1') return true;
  if (override === 'false' || override === '0') return false;
  return configService.get<string>('NODE_ENV') !== 'production';
}
