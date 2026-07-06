import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SmmstoneModule } from '../smmstone/smmstone.module';
import { SmmpanelkingModule } from '../smmpanelking/smmpanelking.module';
import { OrderFulfillmentService } from './order-fulfillment.service';
import { SmmOrderStatusService } from './smm-order-status.service';
import { SmmProviderRegistryService } from './smm-provider.registry';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    NotificationsModule,
    SmmstoneModule,
    SmmpanelkingModule,
  ],
  providers: [SmmProviderRegistryService, SmmOrderStatusService, OrderFulfillmentService],
  exports: [
    SmmProviderRegistryService,
    SmmOrderStatusService,
    OrderFulfillmentService,
    SmmstoneModule,
    SmmpanelkingModule,
  ],
})
export class SmmModule {}
