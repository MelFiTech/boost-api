import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminEmailsController } from '../controllers/admin-emails.controller';
import { NotificationPreferencesModule } from '../notification-preferences/notification-preferences.module';
import { EmailService } from './email.service';

@Module({
  imports: [ConfigModule, NotificationPreferencesModule],
  controllers: [AdminEmailsController],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
