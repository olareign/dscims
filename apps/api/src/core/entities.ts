import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import type { Role } from '@dscims/shared';
import { TenantScopedEntity } from '../common/tenant-scoped.entity.js';

// Column names and types mirror scripts/migrations/001-foundation.sql; test/migrations.e2e-spec.ts keeps them honest.
const ts = { type: 'timestamptz' } as const;

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 120 }) name!: string;
  @Column({ type: 'varchar', length: 12, default: 'active' }) status!: 'active' | 'suspended';
  @Column({ ...ts, name: 'grace_ends_at', nullable: true }) graceEndsAt!: Date | null;
  @Column({ ...ts, name: 'onboarded_at', nullable: true }) onboardedAt!: Date | null;
  @Column({ type: 'boolean', name: 'is_demo', default: false }) isDemo!: boolean;
  @Column({ ...ts, name: 'created_at', default: () => 'now()' }) createdAt!: Date;
  @Column({ ...ts, name: 'updated_at', default: () => 'now()' }) updatedAt!: Date;
}

@Entity('shops')
export class Shop extends TenantScopedEntity {
  @Column({ type: 'varchar', length: 120 }) name!: string;
  @Column({ type: 'varchar', length: 300, default: '' }) address!: string;
  @Column({ type: 'double precision', nullable: true }) latitude!: number | null;
  @Column({ type: 'double precision', nullable: true }) longitude!: number | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) phone!: string | null;
  @Column({ type: 'boolean', name: 'is_main', default: false }) isMain!: boolean;
}

@Entity('users')
export class User extends TenantScopedEntity {
  @Column({ type: 'uuid', name: 'shop_id', nullable: true }) shopId!: string | null;
  @Column({ type: 'varchar', length: 120 }) name!: string;
  @Column({ type: 'varchar', length: 254 }) email!: string;
  @Column({ type: 'varchar', length: 100, name: 'password_hash', nullable: true, select: false }) passwordHash!: string | null;
  @Column({ type: 'varchar', length: 10 }) role!: Role;
  @Column({ type: 'varchar', length: 12, default: 'invited' }) status!: 'active' | 'invited' | 'deactivated';
  @Column({ ...ts, name: 'last_sign_in_at', nullable: true }) lastSignInAt!: Date | null;
  @Column({ type: 'integer', name: 'failed_attempts', default: 0 }) failedAttempts!: number;
  @Column({ ...ts, name: 'locked_until', nullable: true }) lockedUntil!: Date | null;
}

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'tenant_id' }) tenantId!: string;
  @Column({ type: 'uuid', name: 'user_id' }) userId!: string;
  @Column({ type: 'varchar', length: 64, nullable: true }) ip!: string | null;
  @Column({ type: 'varchar', length: 300, name: 'user_agent', nullable: true }) userAgent!: string | null;
  @Column({ ...ts, name: 'created_at', default: () => 'now()' }) createdAt!: Date;
  @Column({ ...ts, name: 'expires_at' }) expiresAt!: Date;
  @Column({ ...ts, name: 'revoked_at', nullable: true }) revokedAt!: Date | null;
}

@Entity('user_tokens')
export class UserToken {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'tenant_id' }) tenantId!: string;
  @Column({ type: 'uuid', name: 'user_id' }) userId!: string;
  @Column({ type: 'varchar', length: 10 }) type!: 'invite' | 'reset';
  @Column({ type: 'char', length: 64, name: 'token_hash' }) tokenHash!: string;
  @Column({ ...ts, name: 'expires_at' }) expiresAt!: Date;
  @Column({ ...ts, name: 'used_at', nullable: true }) usedAt!: Date | null;
  @Column({ ...ts, name: 'created_at', default: () => 'now()' }) createdAt!: Date;
}

@Entity('settings')
export class Settings {
  @PrimaryColumn({ type: 'uuid', name: 'tenant_id' }) tenantId!: string;
  @Column({ type: 'integer', name: 'discount_limit_percent', default: 5 }) discountLimitPercent!: number;
  @Column({ type: 'integer', name: 'credit_due_days', default: 30 }) creditDueDays!: 14 | 30 | 60;
  @Column({ type: 'text', name: 'receipt_text' }) receiptText!: string;
  @Column({ ...ts, name: 'created_at', default: () => 'now()' }) createdAt!: Date;
  @Column({ ...ts, name: 'updated_at', default: () => 'now()' }) updatedAt!: Date;
}

@Entity('audit_log')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'tenant_id' }) tenantId!: string;
  @Column({ type: 'uuid', name: 'actor_id', nullable: true }) actorId!: string | null;
  @Column({ type: 'varchar', length: 120, name: 'actor_name' }) actorName!: string;
  @Column({ type: 'varchar', length: 10, name: 'actor_role', nullable: true }) actorRole!: string | null;
  @Column({ type: 'varchar', length: 60 }) action!: string;
  @Column({ type: 'varchar', length: 12 }) category!: 'sign_in' | 'security' | 'user' | 'settings';
  @Column({ type: 'varchar', length: 300 }) message!: string;
  @Column({ type: 'varchar', length: 30, name: 'entity_type', nullable: true }) entityType!: string | null;
  @Column({ type: 'uuid', name: 'entity_id', nullable: true }) entityId!: string | null;
  @Column({ type: 'varchar', length: 160, name: 'entity_label', nullable: true }) entityLabel!: string | null;
  @Column({ type: 'uuid', name: 'shop_id', nullable: true }) shopId!: string | null;
  @Column({ type: 'varchar', length: 120, name: 'shop_name', nullable: true }) shopName!: string | null;
  @Column({ type: 'jsonb', nullable: true }) before!: Record<string, unknown> | null;
  @Column({ type: 'jsonb', nullable: true }) after!: Record<string, unknown> | null;
  @Column({ type: 'varchar', length: 64, nullable: true }) ip!: string | null;
  @Column({ type: 'varchar', length: 300, name: 'user_agent', nullable: true }) userAgent!: string | null;
  @Column({ ...ts, name: 'created_at', default: () => 'now()' }) createdAt!: Date;
}

@Entity('idempotency_keys')
export class IdempotencyKey {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'tenant_id' }) tenantId!: string;
  @Column({ type: 'uuid', name: 'user_id' }) userId!: string;
  @Column({ type: 'varchar', length: 120 }) key!: string;
  @Column({ type: 'char', length: 64, name: 'request_hash' }) requestHash!: string;
  @Column({ type: 'jsonb', nullable: true }) response!: unknown;
  @Column({ ...ts, name: 'created_at', default: () => 'now()' }) createdAt!: Date;
}

@Entity('platform_admins')
export class PlatformAdmin {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 254 }) email!: string;
  @Column({ type: 'varchar', length: 120 }) name!: string;
  @Column({ type: 'varchar', length: 100, name: 'password_hash', select: false }) passwordHash!: string;
  @Column({ ...ts, name: 'created_at', default: () => 'now()' }) createdAt!: Date;
}

export const ENTITIES = [Tenant, Shop, User, Session, UserToken, Settings, AuditLog, IdempotencyKey, PlatformAdmin];
