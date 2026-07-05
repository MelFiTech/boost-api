import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { BankAccountsModule } from '../bank-accounts/bank-accounts.module';
import { AppSettingsModule } from '../app-settings/app-settings.module';
import { KycModule } from '../kyc/kyc.module';
import { EmailModule } from '../emails/email.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PinModule } from '../pin/pin.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProvidersModule } from '../providers/providers.module';
import { WalletController } from './wallet.controller';
import { WalletGateway } from './wallet.gateway';
import { WalletService } from './wallet.service';

@Module({
  imports: [
    PrismaModule,
    AppSettingsModule,
    EmailModule,
    NotificationsModule,
    forwardRef(() => ProvidersModule),
    KycModule,
    forwardRef(() => BankAccountsModule),
    PinModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [WalletController],
  providers: [WalletService, WalletGateway],
  exports: [WalletService, WalletGateway],
})
export class WalletModule {}
