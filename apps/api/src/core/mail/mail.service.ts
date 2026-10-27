import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { AppConfig } from '../../config/app-config.js';

export interface OutboxMessage {
  to: string;
  subject: string;
  text: string;
  link: string;
}

@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  /** In development and test with no SMTP, messages are kept here (and logged) instead of sent. */
  readonly outbox: OutboxMessage[] = [];

  constructor(private readonly config: AppConfig) {}

  get configured(): boolean {
    return this.config.mailConfigured;
  }

  /** Returns true when the email was handed to a mail server (or to the dev outbox). */
  async send(message: OutboxMessage): Promise<boolean> {
    if (!this.config.mailConfigured) {
      if (this.config.isProduction) return false;
      this.outbox.push(message);
      this.log.log(`[dev mail] to ${message.to}: ${message.subject} ${message.link}`);
      return true;
    }
    const { env } = this.config;
    this.transporter ??= nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
    try {
      await this.transporter.sendMail({
        from: `"${env.MAIL_FROM_NAME}" <${env.MAIL_FROM_ADDRESS}>`,
        to: message.to,
        subject: message.subject,
        text: message.text,
      });
      return true;
    } catch (err) {
      this.log.error(`Could not send email to ${message.to}: ${(err as Error).message}`);
      return false;
    }
  }

  invite(to: string, name: string, business: string, link: string): Promise<boolean> {
    return this.send({
      to,
      subject: `${business} invited you to d-scims`,
      link,
      text: `Hello ${name},\n\n${business} added you to d-scims. Set your password here (the link works for 24 hours):\n${link}\n\nIf you were not expecting this, ignore this email.`,
    });
  }

  reset(to: string, name: string, link: string): Promise<boolean> {
    return this.send({
      to,
      subject: 'Reset your d-scims password',
      link,
      text: `Hello ${name},\n\nUse this link to set a new password (it works for 30 minutes):\n${link}\n\nIf you did not ask for this, ignore this email. Your password has not changed.`,
    });
  }
}
