import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { ClaimsModule } from './claims/claims.module';
import { ClockModule } from './common/clock.service';
import { validateEnv } from './config/env.validation';
import { DevModule } from './dev/dev.module';
import { HealthModule } from './health/health.module';
import { InsuranceModule } from './insurance/insurance.module';
import { MailModule } from './mail/mail.service';
import { PaymentActionsModule } from './payments/payment-actions.module';
import { PaymentsModule } from './payments/payments.module';
import { PlansModule } from './plans/plans.module';
import { PrismaModule } from './prisma/prisma.service';
import { QuotesModule } from './quotes/quotes.module';
import { SupportModule } from './support/support.module';

const devToolsEnabled = () =>
  process.env.ENABLE_DEV_TOOLS === 'true' &&
  process.env.NODE_ENV !== 'production';

@Module({})
export class AppModule {
  static register(opts: { scheduler?: boolean } = {}): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
        ThrottlerModule.forRoot({
          throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
          // Nos testes o limite só vale quando o próprio teste liga TEST_THROTTLE.
          skipIf: () =>
            process.env.NODE_ENV === 'test' &&
            process.env.TEST_THROTTLE !== 'true',
        }),
        ...(opts.scheduler !== false ? [ScheduleModule.forRoot()] : []),
        PrismaModule,
        ClockModule,
        MailModule,
        AuthModule,
        HealthModule,
        PlansModule,
        QuotesModule,
        PaymentsModule,
        InsuranceModule,
        ClaimsModule,
        PaymentActionsModule,
        SupportModule,
        ...(devToolsEnabled() ? [DevModule] : []),
      ],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    };
  }
}
