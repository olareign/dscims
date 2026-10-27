import { describe, expect, it, vi } from 'vitest';
import { FakeMailer } from './fake.mailer.js';
import { MailService } from './mail.service.js';
import type { MailMessage } from './mailer.port.js';
import { ResendMailer } from './resend.mailer.js';
import { SmtpMailer, resolveSecure } from './smtp.mailer.js';

const message: MailMessage = { to: 'ada@example.test', subject: 'Hi', text: 'Open https://web.test/invite/abc now', html: '<p>Hi</p>', idempotencyKey: 'invite-123' };

describe('ResendMailer', () => {
  it('sends with the idempotency key', async () => {
    const send = vi.fn().mockResolvedValue({ data: { id: 'x' }, error: null });
    await new ResendMailer({ apiKey: 're_test', from: 'd-scims <no-reply@example.test>' }, { emails: { send } } as never).send(message);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ from: 'd-scims <no-reply@example.test>', to: 'ada@example.test' }), { idempotencyKey: 'invite-123' });
  });

  it('treats an error in the result as a failure and keeps the key and recipient out of the message', async () => {
    const send = vi.fn().mockResolvedValue({ data: null, error: { name: 'validation_error', statusCode: 403, message: 'domain not verified for ada@example.test using re_secret' } });
    const mailer = new ResendMailer({ apiKey: 're_secret', from: 'x@example.test' }, { emails: { send } } as never);
    const err = await mailer.send(message).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe('Email provider rejected the message (Resend validation_error 403)');
    expect((err as Error).message).not.toMatch(/re_secret|ada@/);
  });

  it('wraps a thrown error the same way', async () => {
    const send = vi.fn().mockRejectedValue(Object.assign(new Error('boom ada@example.test'), { code: 'ECONNRESET' }));
    await expect(new ResendMailer({ apiKey: 'k', from: 'f' }, { emails: { send } } as never).send(message)).rejects.toThrow('Email provider rejected the message (Resend ECONNRESET)');
  });
});

describe('SmtpMailer', () => {
  const settings = { host: 'smtp.example.test', port: 587, user: 'u', password: 'p', from: 'd-scims <no-reply@example.test>' };

  it('sends with a stable Message-ID', async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    await new SmtpMailer(settings, { sendMail }).send(message);
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: settings.from, to: message.to, messageId: '<invite-123@dscims.mail>' }));
  });

  it('reports only short codes when the server refuses', async () => {
    const sendMail = vi.fn().mockRejectedValue(Object.assign(new Error('550 mailbox ada@example.test unavailable'), { code: 'EENVELOPE', responseCode: 550 }));
    const err = await new SmtpMailer(settings, { sendMail }).send(message).catch((e: Error) => e);
    expect((err as Error).message).toBe('Email provider rejected the message (SMTP EENVELOPE 550)');
  });

  it('always uses implicit TLS on port 465', () => {
    expect(resolveSecure(465, false)).toBe(true);
    expect(resolveSecure(587, undefined)).toBe(false);
    expect(resolveSecure(587, true)).toBe(true);
  });
});

describe('MailService', () => {
  it('returns true and records the link with the fake provider', async () => {
    const fake = new FakeMailer();
    const ok = await new MailService(fake).invite('ada@example.test', 'Ada Eze', 'Ade <Gadgets> Ltd', 'https://web.test/invite/tok');
    expect(ok).toBe(true);
    expect(fake.outbox[0].link).toBe('https://web.test/invite/tok');
    expect(fake.outbox[0].html).toContain('Ade &lt;Gadgets&gt; Ltd');
    expect(fake.outbox[0].html).not.toContain('<Gadgets>');
  });

  it('returns false instead of throwing when the provider fails, so the owner can share the link', async () => {
    const failing = { send: vi.fn().mockRejectedValue(new Error('Email provider rejected the message (SMTP ETIMEDOUT)')) };
    expect(await new MailService(failing).reset('ada@example.test', 'Ada', 'https://web.test/reset-password/tok')).toBe(false);
  });

  it('uses the same idempotency key for the same link, so a retry is not delivered twice', async () => {
    const fake = new FakeMailer();
    const mail = new MailService(fake);
    await mail.invite('a@example.test', 'A B', 'Biz', 'https://web.test/invite/one');
    await mail.invite('a@example.test', 'A B', 'Biz', 'https://web.test/invite/one');
    expect(fake.outbox[0].idempotencyKey).toBe(fake.outbox[1].idempotencyKey);
  });
});
