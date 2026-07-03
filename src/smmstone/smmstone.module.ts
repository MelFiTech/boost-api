import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrderFulfillmentService } from './order-fulfillment.service';
import { SmmstoneService } from './smmstone.service';

@Module({
  imports: [ConfigModule, PrismaModule, NotificationsModule],
  providers: [SmmstoneService, OrderFulfillmentService],
  exports: [SmmstoneService, OrderFulfillmentService],
})
export class SmmstoneModule {} 