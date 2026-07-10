import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { FeaturesModule } from '../features/features.module';
import { PinModule } from '../pin/pin.module';
import { WalletModule } from '../wallet/wallet.module';
import { FleexaVirtualNumberProvider } from './fleexa/fleexa-virtual-number.provider';
import { VirtualNumberProviderRegistryService } from './virtual-number.registry';
import { VirtualNumberStatusService } from './virtual-number-status.service';
import { VirtualNumbersController } from './virtual-numbers.controller';
import { VirtualNumbersService } from './virtual-numbers.service';

@Module({
  imports: [ConfigModule, PrismaModule, FeaturesModule, WalletModule, PinModule],
  controllers: [VirtualNumbersController],
  providers: [
    FleexaVirtualNumberProvider,
    VirtualNumberProviderRegistryService,
    VirtualNumbersService,
    VirtualNumberStatusService,
  ],
  exports: [
    VirtualNumberProviderRegistryService,
    VirtualNumbersService,
    FleexaVirtualNumberProvider,
  ],
})
export class VirtualNumbersModule {}
