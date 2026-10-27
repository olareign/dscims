import { createTransport } from 'nodemailer';
import type { MailMessage, Mailer } from './mailer.port.js';

export interface SmtpSettings {
  host: string;
  port: number;
  /** Port 465 is always implicit TLS, whatever this says; other ports upgrade with STARTTLS. */
  secure?: boolean;
  user: string;
  password: string;
  from: string;
}

/** The part of a nodemailer transport the mailer uses; tests pass a stand-in. */
export interface SmtpTransport {
  sendMail(options: Record<string, unknown>): Promise<unknown>;
}

export const resolveSecure = (port: number, secure: boolean | undefined): boolean => (port === 465 ? true : (secure ?? false));

export class SmtpMailer implements Mailer {
  private readonly transport: SmtpTransport;

  constructor(private readonly settings: SmtpSettings, transport?: SmtpTransport) {
    this.transport =
      transport ??
      createTransport({
        host: settings.host,
        port: settings.port,
        secure: resolveSecure(settings.port, settings.secure),
        requireTLS: true,
        auth: { user: settings.user, pass: settings.password },
        connectionTimeout: 30_000,
        greetingTimeout: 15_000,
        socketTimeout: 30_000,
      });
  }

  async send(message: MailMessage): Promise<void> {
    try {
      await this.transport.sendMail({
        from: this.settings.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        // SMTP has no idempotency key; a stable Message-ID lets receivers drop duplicates.
        messageId: `<${message.idempotencyKey.replace(/[^\w.-]/g, '-')}@dscims.mail>`,
      });
    } catch (error) {
      // Only the error's short code reaches the logs: the full text can echo the server's reply.
      const { code, responseCode } = error as { code?: unknown; responseCode?: unknown };
      const detail = [code, responseCode].filter((x) => typeof x === 'string' || typeof x === 'number');
      throw new Error(`Email provider rejected the message (SMTP${detail.length ? ` ${detail.join(' ')}` : ''})`);
    }
  }
}
