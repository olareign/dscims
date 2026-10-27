import { Global, Injectable, Module } from '@nestjs/common';
import { z } from 'zod';

const boolean = z.enum(['true', 'false']).default('false').transform((v) => v === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3006),
  WEB_ORIGIN: z.string().default('http://localhost:3001'),
  PUBLIC_WEB_URL: z.string().default('http://localhost:3001'),
  DATABASE_URL: z.string().optional(),
  // Direct (non-pooled) connection used for migrations; falls back to DATABASE_URL.
  MIGRATION_DATABASE_URL: z.string().optional(),
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
  // Email: `smtp` or `resend` (each requires its own credentials); `fake` is for tests only and refused in production.
  EMAIL_TYPE: z.enum(['fake', 'resend', 'smtp']).default('fake'),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_SECURE: boolean,
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  // Private files (seller IDs, proof of ownership, device photos): Cloudinary in production, a local folder otherwise.
  CLOUDINARY_URL: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  LOCAL_STORAGE_DIR: z.string().default('.storage'),
  // Encrypts NIN and BVN at rest (SELL-1). Any string of 32+ characters: openssl rand -base64 32
  FIELD_ENCRYPTION_KEY: z.string().min(32, 'FIELD_ENCRYPTION_KEY must be at least 32 characters (openssl rand -base64 32)').optional(),
  GEOCODER_USER_AGENT: z.string().default('d-scims/0.1 (rolatzarza@gmail.com)'),
  GEOCODER_URL: z.string().default('https://nominatim.openstreetmap.org/reverse'),
}).superRefine((env, ctx) => {
  const need = (names: (keyof typeof env)[], provider: string) => {
    for (const name of names) if (!env[name]) ctx.addIssue({ code: 'custom', path: [name], message: `${name} is required when EMAIL_TYPE=${provider}` });
  };
  if (env.EMAIL_TYPE === 'resend') need(['RESEND_API_KEY', 'RESEND_FROM'], 'resend');
  if (env.EMAIL_TYPE === 'smtp') need(['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'], 'smtp');
  if (env.NODE_ENV === 'production') {
    if (!env.FIELD_ENCRYPTION_KEY) ctx.addIssue({ code: 'custom', path: ['FIELD_ENCRYPTION_KEY'], message: 'FIELD_ENCRYPTION_KEY is required in production' });
    const cloudinary = env.CLOUDINARY_URL || (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
    if (!cloudinary) ctx.addIssue({ code: 'custom', path: ['CLOUDINARY_URL'], message: 'Cloudinary is required in production: set CLOUDINARY_URL (cloudinary://key:secret@cloud-name)' });
  }
  if (env.NODE_ENV === 'production' && env.EMAIL_TYPE === 'fake') {
    ctx.addIssue({ code: 'custom', path: ['EMAIL_TYPE'], message: 'EMAIL_TYPE=fake is not allowed in production. Use smtp or resend.' });
  }
});

export type Env = z.infer<typeof envSchema>;

/** Parses and checks environment variables; throws one readable error naming every problem. */
export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${problems}`);
  }
  return parsed.data;
}

/** The one place that reads process.env. */
@Injectable()
export class AppConfig {
  readonly env: Env;

  constructor() {
    this.env = parseEnv(process.env);
  }

  get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }
}

@Global()
@Module({ providers: [AppConfig], exports: [AppConfig] })
export class AppConfigModule {}
