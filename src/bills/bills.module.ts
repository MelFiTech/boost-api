import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FeaturesModule } from '../features/features.module';
import { ProvidersModule } from '../providers/providers.module';
import { PinModule } from '../pin/pin.module';
import { WalletModule } from '../wallet/wallet.module';
import { BillsController } from './bills.controller';
import { BillsService } from './bills.service';

@Module({
  imports: [PrismaModule, FeaturesModule, ProvidersModule, WalletModule, PinModule],
  controllers: [BillsController],
  providers: [BillsService],
  exports: [BillsService],
})
export class BillsModule {}
