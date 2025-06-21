import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsController } from '../controllers/notifications.controller';
import { NotificationService } from '../services/notification.service';
import { ExpoPushService } from '../services/expo-push.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationService,
    ExpoPushService,
  ],
  exports: [
    NotificationService,
    ExpoPushService,
  ],
})
export class NotificationsModule {} 