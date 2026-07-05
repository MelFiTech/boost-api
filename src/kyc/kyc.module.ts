import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProvidersModule } from '../providers/providers.module';
import { EmailModule } from '../emails/email.module';
import { KycController } from './kyc.controller';
import { AdminKycController } from './admin-kyc.controller';
import { KycService } from './kyc.service';

@Module({
  imports: [PrismaModule, EmailModule, forwardRef(() => ProvidersModule)],
  controllers: [KycController, AdminKycController],
  providers: [KycService],
  exports: [KycService],
})
export class KycModule {}
