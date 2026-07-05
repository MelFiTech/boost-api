import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../emails/email.module';
import { NotificationPreferencesModule } from '../notification-preferences/notification-preferences.module';
import { AdminNotificationsController } from '../controllers/admin-notifications.controller';
import { NotificationsController } from '../controllers/notifications.controller';
import { NotificationService } from '../services/notification.service';
import { ExpoPushService } from '../services/expo-push.service';

@Module({
  imports: [
    ConfigModule,
    EmailModule,
    PrismaModule,
    NotificationPreferencesModule,
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