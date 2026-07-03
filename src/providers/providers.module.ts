import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WalletModule } from '../wallet/wallet.module';
import { NyraApiService } from './nyra/nyra-api.service';
import { NyraBillsProvider } from './nyra/nyra-bills.provider';
import { NyraFundingProvider } from './nyra/nyra-funding.provider';
import { NyraTransferService } from './nyra/nyra-transfer.service';
import { NyraVasApiService } from './nyra/nyra-vas-api.service';
import { NyraWebhookService } from './nyra/nyra-webhook.service';
import { ProviderRegistryService } from './provider-registry.service';
import { AdminProvidersController } from './providers.controller';

@Module({
  imports: [PrismaModule, forwardRef(() => WalletModule), forwardRef(() => NotificationsModule)],
  controllers: [AdminProvidersController],
  providers: [
    NyraApiService,
    NyraVasApiService,
    NyraTransferService,
    NyraFundingProvider,
    NyraBillsProvider,
    NyraWebhookService,
    ProviderRegistryService,
  ],
  exports: [ProviderRegistryService, NyraApiService, NyraVasApiService, NyraTransferService, NyraWebhookService],
})
export class ProvidersModule {}
