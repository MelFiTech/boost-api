import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SMMService } from './services/smm.service';
import { PlatformService } from './services/platform.service';
import { OrdersService } from './services/orders.service';
import { PaymentService } from './services/payment.service';
import { BudPayService } from './services/budpay.service';
import { NotificationService } from './services/notification.service';
import { SMMController } from './controllers/smm.controller';
import { OrdersController } from './controllers/orders.controller';
import { PaymentController } from './controllers/payment.controller';
import { AdminController } from './controllers/admin.controller';
import { LoggerMiddleware } from './middleware/logger.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    NotificationsModule,
  ],
  controllers: [AppController, SMMController, OrdersController, PaymentController, AdminController],
  providers: [AppService, SMMService, PlatformService, OrdersService, PaymentService, BudPayService, NotificationService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
