import { Inject, Injectable, Logger } from '@nestjs/common';
import { sha256 } from '../../common/crypto.js';
import { FakeMailer } from './fake.mailer.js';
import type { OutboxMessage } from './fake.mailer.js';
import { MAILER } from './mailer.port.js';
import type { Mailer, MailMessage } from './mailer.port.js';

const escapeHtml = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function layout(heading: string, intro: string, buttonLabel: string, link: string, outro: string): string {
  return `<!doctype html><html><body style="margin:0;background:#F3F5FA;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0F172A">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<div style="font-weight:800;font-size:20px;color:#0D1B4C;margin-bottom:20px">d-scims</div>
<div style="background:#fff;border-radius:16px;padding:28px;border:1px solid #E2E8F0">
<h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(heading)}</h1>
<p style="line-height:1.5;margin:0 0 20px">${intro}</p>
<p style="margin:0 0 20px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#0D1B4C;color:#fff;text-decoration:none;font-weight:600;padding:14px 22px;border-radius:12px">${escapeHtml(buttonLabel)}</a></p>
<p style="font-size:13px;color:#475569;line-height:1.5;margin:0">${outro}<br><br>If the button does not work, copy this address into your browser:<br><span style="word-break:break-all">${escapeHtml(link)}</span></p>
</div></div></body></html>`;
}

@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);

  constructor(@Inject(MAILER) private readonly mailer: Mailer) {}

  /** Messages kept in memory when the provider is the development stand-in. Empty for real providers. */
  get outbox(): OutboxMessage[] {
    return this.mailer instanceof FakeMailer ? this.mailer.outbox : [];
  }

  /** Returns true when the provider accepted the message. A failure is logged and never thrown, so the caller can show the link instead. */
  async send(message: MailMessage): Promise<boolean> {
    try {
      await this.mailer.send(message);
      return true;
    } catch (err) {
      this.log.error(`Could not send email: ${(err as Error).message}`);
      return false;
    }
  }

  invite(to: string, name: string, business: string, link: string): Promise<boolean> {
    return this.send({
      to,
      subject: `${business} invited you to d-scims`,
      text: `Hello ${name},\n\n${business} added you to d-scims. Set your password here (the link works for 24 hours):\n${link}\n\nIf you were not expecting this, ignore this email.`,
      html: layout(`Welcome, ${name.split(' ')[0]}`, `<b>${escapeHtml(business)}</b> added you to d-scims. Set your password to get started. You will sign in with this email address.`, 'Set my password', link, 'This link works for 24 hours and only once. If you were not expecting this, ignore this email.'),
      idempotencyKey: `invite-${sha256(link)}`,
    });
  }

  reset(to: string, name: string, link: string): Promise<boolean> {
    return this.send({
      to,
      subject: 'Reset your d-scims password',
      text: `Hello ${name},\n\nUse this link to set a new password (it works for 30 minutes):\n${link}\n\nIf you did not ask for this, ignore this email. Your password has not changed.`,
      html: layout('Reset your password', `Hello ${escapeHtml(name)}, use the button below to set a new password.`, 'Set a new password', link, 'This link works for 30 minutes. If you did not ask for this, ignore this email. Your password has not changed.'),
      idempotencyKey: `reset-${sha256(link)}`,
    });
  }
}
