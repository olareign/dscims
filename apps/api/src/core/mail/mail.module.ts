import { Global, Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.js';
import { FakeMailer } from './fake.mailer.js';
import { MailService } from './mail.service.js';
import { MAILER } from './mailer.port.js';
import type { Mailer } from './mailer.port.js';
import { ResendMailer } from './resend.mailer.js';
import { SmtpMailer } from './smtp.mailer.js';

/**
 * The provider is chosen by EMAIL_TYPE: `smtp` or `resend` (any environment), `fake` for tests.
 * The environment schema refuses `fake` in production and checks each provider's settings at start-up.
 */
@Global()
@Module({
  providers: [
    {
      provide: MAILER,
      inject: [AppConfig],
      useFactory: ({ env }: AppConfig): Mailer =>
        env.EMAIL_TYPE === 'smtp'
          ? new SmtpMailer({ host: env.SMTP_HOST!, port: env.SMTP_PORT, secure: env.SMTP_SECURE, user: env.SMTP_USER!, password: env.SMTP_PASSWORD!, from: env.SMTP_FROM! })
          : env.EMAIL_TYPE === 'resend'
            ? new ResendMailer({ apiKey: env.RESEND_API_KEY!, from: env.RESEND_FROM! })
            : new FakeMailer(),
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
