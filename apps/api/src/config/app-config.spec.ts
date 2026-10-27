import { describe, expect, it } from 'vitest';
import { parseEnv } from './app-config.js';

const base = { JWT_SECRET: 'x'.repeat(32) };

describe('environment', () => {
  it('uses the fake mailer by default outside production', () => {
    expect(parseEnv({ ...base, NODE_ENV: 'development' }).MAIL_PROVIDER).toBe('fake');
  });

  it('refuses the fake mailer in production', () => {
    expect(() => parseEnv({ ...base, NODE_ENV: 'production' })).toThrow(/MAIL_PROVIDER=fake is not allowed in production/);
  });

  it('requires Resend settings for the resend provider', () => {
    expect(() => parseEnv({ ...base, MAIL_PROVIDER: 'resend' })).toThrow(/RESEND_API_KEY is required.*RESEND_FROM is required/);
    expect(parseEnv({ ...base, MAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_x', RESEND_FROM: 'd-scims <a@b.test>' }).MAIL_PROVIDER).toBe('resend');
  });

  it('requires every SMTP setting for the smtp provider, and accepts it in production', () => {
    expect(() => parseEnv({ ...base, NODE_ENV: 'production', MAIL_PROVIDER: 'smtp' })).toThrow(/SMTP_HOST is required.*SMTP_USER is required.*SMTP_PASSWORD is required.*SMTP_FROM is required/);
    const env = parseEnv({ ...base, NODE_ENV: 'production', MAIL_PROVIDER: 'smtp', SMTP_HOST: 'smtp.test', SMTP_USER: 'u', SMTP_PASSWORD: 'p', SMTP_FROM: 'd-scims <a@b.test>' });
    expect(env.SMTP_PORT).toBe(587);
  });

  it('needs a long JWT secret', () => {
    expect(() => parseEnv({ JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });
});
