import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminNotificationsController } from '../controllers/admin-notifications.controller';
import { NotificationsController } from '../controllers/notifications.controller';
import { NotificationService } from '../services/notification.service';
import { ExpoPushService } from '../services/expo-push.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
  ],
  controllers: [NotificationsController, AdminNotificationsController],
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