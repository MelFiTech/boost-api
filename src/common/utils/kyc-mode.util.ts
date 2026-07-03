import { ConfigService } from '@nestjs/config';

/** True when KYC/bank/withdraw checks should skip live Nyra verification. */
export function isKycDevMode(configService: ConfigService): boolean {
  const mode = configService.get<string>('KYC_VERIFICATION_MODE')?.toLowerCase();
  if (mode === 'prod' || mode === 'production') {
    return false;
  }
  if (mode === 'dev' || mode === 'development') {
    return true;
  }
  return configService.get<string>('NODE_ENV') !== 'production';
}
