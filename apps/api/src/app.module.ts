import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { IdempotencyInterceptor } from './common/idempotency.interceptor.js';
import { AppConfig, AppConfigModule } from './config/app-config.js';
import { AuthGuard, CapabilityGuard } from './core/auth/auth.guard.js';
import { CoreModule } from './core/core.module.js';
import { DatabaseModule } from './database/database.module.js';
import { StorageModule } from './storage/storage.module.js';
import { HealthModule } from './health/health.module.js';
import { BillingModule } from './billing/billing.module.js';
import { DemoModule } from './demo/demo.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PartiesModule } from './parties/parties.module.js';
import { ReportingModule } from './reporting/reporting.module.js';
import { TransactionsModule } from './transactions/transactions.module.js';

@Module({
  imports: [
    // Loads .env into process.env before AppConfig reads it.
    ConfigModule.forRoot({ isGlobal: true }),
    AppConfigModule,
    // 120 requests a minute per address overall; sign-in and reset routes set stricter limits.
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60000, limit: 120 }], skipIf: () => process.env.NODE_ENV === 'test' }),
    DatabaseModule,
    StorageModule,
    // Jobs (PDFs, reports, reminders) arrive in later phases. Handlers must be idempotent.
    BullModule.forRootAsync({
      inject: [AppConfig],
      useFactory: ({ env }: AppConfig) => ({
        connection: env.REDIS_URL ? { url: env.REDIS_URL } : { host: env.REDIS_HOST, port: env.REDIS_PORT },
      }),
    }),
    HealthModule,
    CoreModule,
    PartiesModule,
    InventoryModule,
    TransactionsModule,
    DocumentsModule,
    ReportingModule,
    BillingModule,
    NotificationsModule,
    DemoModule,
  ],
  providers: [
    // Order matters: throttle, then sign-in and tenant state, then the role matrix.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: CapabilityGuard },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
})
export class AppModule {}
