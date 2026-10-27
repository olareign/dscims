import { Global, Injectable, Module } from '@nestjs/common';
import { z } from 'zod';

const boolean = z.enum(['true', 'false']).default('false').transform((v) => v === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3006),
  WEB_ORIGIN: z.string().default('http://localhost:3001'),
  PUBLIC_WEB_URL: z.string().default('http://localhost:3001'),
  DATABASE_URL: z.string().optional(),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().int().default(5456),
  DB_USERNAME: z.string().default('dscims_user'),
  DB_PASSWORD: z.string().default('dscims_password'),
  DB_DATABASE: z.string().default('dscims_db'),
  DB_SSL: boolean,
  RUN_MIGRATIONS: boolean,
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().default(6381),
  REDIS_URL: z.string().optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters (openssl rand -hex 32)'),
  SESSION_DAYS: z.coerce.number().int().min(1).max(90).default(14),
  TENANT_GRACE_DAYS: z.coerce.number().int().min(0).max(90).default(7),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  ENABLE_API_DOCS: boolean,
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_SECURE: boolean,
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM_ADDRESS: z.string().optional(),
  MAIL_FROM_NAME: z.string().default('d-scims'),
  GEOCODER_USER_AGENT: z.string().default('d-scims/0.1 (contact: set GEOCODER_USER_AGENT)'),
  GEOCODER_URL: z.string().default('https://nominatim.openstreetmap.org/reverse'),
});

export type Env = z.infer<typeof envSchema>;

/** The one place that reads process.env. */
@Injectable()
export class AppConfig {
  readonly env: Env;

  constructor() {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw new Error(`Invalid environment: ${problems}`);
    }
    this.env = parsed.data;
  }

  get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }

  get mailConfigured(): boolean {
    return Boolean(this.env.SMTP_HOST && this.env.MAIL_FROM_ADDRESS);
  }
}

@Global()
@Module({ providers: [AppConfig], exports: [AppConfig] })
export class AppConfigModule {}
