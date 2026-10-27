import { Logger } from '@nestjs/common';
import type { MailMessage, Mailer } from './mailer.port.js';

export interface OutboxMessage extends MailMessage {
  /** The first link in the message, so tests and developers can follow it. */
  link: string;
}

/** Keeps messages in memory and logs them. For tests, and for development with no email provider. Refused in production. */
export class FakeMailer implements Mailer {
  private readonly log = new Logger('FakeMailer');
  readonly outbox: OutboxMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    const link = /https?:\/\/\S+/.exec(message.text)?.[0] ?? '';
    this.outbox.push({ ...message, link });
    this.log.log(`[dev mail] to ${message.to}: ${message.subject} ${link}`);
  }
}
