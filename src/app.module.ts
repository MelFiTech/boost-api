import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SmmstoneModule } from './smmstone/smmstone.module';
import { EmailModule } from './emails/email.module';
import { FeaturesModule } from './features/features.module';
import { AppSettingsModule } from './app-settings/app-settings.module';
import { ProvidersModule } from './providers/providers.module';
import { WalletModule } from './wallet/wallet.module';
import { BillsModule } from './bills/bills.module';
import { KycModule } from './kyc/kyc.module';
import { BankAccountsModule } from './bank-accounts/bank-accounts.module';
import { PinModule } from './pin/pin.module';
import { AdminUiModule } from './admin-ui/admin-ui.module';
import { NotificationPreferencesModule } from './notification-preferences/notification-preferences.module';
import { StorageModule } from './storage/storage.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SMMService } from './services/smm.service';
import { PlatformService } from './services/platform.service';
import { OrdersService } from './services/orders.service';
import { PaymentService } from './services/payment.service';
import { NotificationService } from './services/notification.service';
import { UserService } from './services/user.service';
import { AdminDashboardService } from './services/admin-dashboard.service';
import { AdminOrdersService } from './services/admin-orders.service';
import { AdminOrdersController } from './controllers/admin-orders.controller';
import { SmmstoneService } from './smmstone/smmstone.service';
import { SMMController } from './controllers/smm.controller';
import { OrdersController } from './controllers/orders.controller';
import { PaymentController } from './controllers/payment.controller';
import { AdminController } from './controllers/admin.controller';
import { UserController, UserOrdersController } from './controllers/user.controller';
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
    SmmstoneModule,
    EmailModule,
    FeaturesModule,
    AppSettingsModule,
    ProvidersModule,
    WalletModule,
    BillsModule,
    KycModule,
    BankAccountsModule,
    PinModule,
    AdminUiModule,
    NotificationPreferencesModule,
    StorageModule,
  ],
  controllers: [AppController, SMMController, OrdersController, PaymentController, AdminController, AdminOrdersController, UserController, UserOrdersController],
  providers: [AppService, SMMService, PlatformService, OrdersService, PaymentService, NotificationService, UserService, SmmstoneService, AdminDashboardService, AdminOrdersService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
