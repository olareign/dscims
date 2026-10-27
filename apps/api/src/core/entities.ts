import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import type { DeviceCondition, DeviceStatus, FlagOutcome, FlagType, PaymentMethod, ProofOfOwnershipType, Role } from '@dscims/shared';
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
  @Column({ type: 'varchar', length: 12 }) category!: 'sign_in' | 'security' | 'user' | 'settings' | 'stock';
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

// Money is bigint kobo in Postgres; pg returns it as a string, so it is converted to a number here (kobo stays far below 2^53).
const kobo = { to: (v: number | undefined) => v, from: (v: string | null) => (v === null ? null : Number(v)) };

@Entity('files')
export class StoredFileRow extends TenantScopedEntity {
  @Column({ type: 'varchar', length: 12 }) kind!: 'seller_id' | 'device_photo' | 'proof';
  @Column({ type: 'varchar', length: 300, name: 'storage_key' }) storageKey!: string;
  @Column({ type: 'varchar', length: 12, name: 'resource_type', nullable: true }) resourceType!: string | null;
  @Column({ type: 'varchar', length: 12, nullable: true }) format!: string | null;
  @Column({ type: 'varchar', length: 200 }) filename!: string;
  @Column({ type: 'varchar', length: 100 }) mime!: string;
  @Column({ type: 'integer' }) bytes!: number;
  @Column({ type: 'char', length: 64, name: 'content_hash' }) contentHash!: string;
}

@Entity('sellers')
export class Seller extends TenantScopedEntity {
  @Column({ type: 'varchar', length: 120 }) name!: string;
  @Column({ type: 'varchar', length: 11 }) phone!: string;
  @Column({ type: 'varchar', length: 300 }) address!: string;
  @Column({ type: 'text', name: 'nin_encrypted', nullable: true, select: false }) ninEncrypted!: string | null;
  @Column({ type: 'char', length: 4, name: 'nin_last4', nullable: true }) ninLast4!: string | null;
  @Column({ type: 'text', name: 'bvn_encrypted', nullable: true, select: false }) bvnEncrypted!: string | null;
  @Column({ type: 'char', length: 4, name: 'bvn_last4', nullable: true }) bvnLast4!: string | null;
  @Column({ type: 'uuid', name: 'id_file_id', nullable: true }) idFileId!: string | null;
}

@Entity('purchases')
export class Purchase {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'tenant_id' }) tenantId!: string;
  @Column({ type: 'uuid', name: 'shop_id' }) shopId!: string;
  @Column({ type: 'uuid', name: 'seller_id' }) sellerId!: string;
  @Column({ type: 'integer' }) number!: number;
  @Column({ type: 'varchar', length: 10, name: 'payment_method' }) paymentMethod!: PaymentMethod;
  @Column({ type: 'bigint', name: 'total_kobo', transformer: kobo }) totalKobo!: number;
  @Column({ type: 'bigint', name: 'paid_kobo', transformer: kobo }) paidKobo!: number;
  @Column({ type: 'varchar', length: 120, name: 'declared_by' }) declaredBy!: string;
  @Column({ ...ts, name: 'declared_at' }) declaredAt!: Date;
  @Column({ type: 'uuid', name: 'created_by' }) createdBy!: string;
  @Column({ type: 'varchar', length: 120, name: 'created_by_name' }) createdByName!: string;
  @Column({ ...ts, name: 'created_at', default: () => 'now()' }) createdAt!: Date;
  @Column({ ...ts, name: 'updated_at', default: () => 'now()' }) updatedAt!: Date;
}

@Entity('devices')
export class Device extends TenantScopedEntity {
  @Column({ type: 'uuid', name: 'shop_id' }) shopId!: string;
  @Column({ type: 'uuid', name: 'purchase_id', nullable: true }) purchaseId!: string | null;
  @Column({ type: 'uuid', name: 'seller_id', nullable: true }) sellerId!: string | null;
  @Column({ type: 'varchar', length: 60 }) brand!: string;
  @Column({ type: 'varchar', length: 80 }) model!: string;
  @Column({ type: 'varchar', length: 20, nullable: true }) storage!: string | null;
  @Column({ type: 'varchar', length: 40, nullable: true }) colour!: string | null;
  @Column({ type: 'char', length: 15 }) imei!: string;
  @Column({ type: 'varchar', length: 14 }) condition!: DeviceCondition;
  @Column({ type: 'varchar', length: 14, default: 'in_stock' }) status!: DeviceStatus;
  @Column({ type: 'varchar', length: 14, name: 'status_before_flag', nullable: true }) statusBeforeFlag!: DeviceStatus | null;
  @Column({ type: 'bigint', name: 'cost_kobo', transformer: kobo }) costKobo!: number;
  @Column({ type: 'bigint', name: 'selling_kobo', transformer: kobo }) sellingKobo!: number;
  @Column({ type: 'varchar', length: 34, name: 'proof_type', default: 'receipt' }) proofType!: ProofOfOwnershipType;
  @Column({ type: 'varchar', length: 300, name: 'proof_note', nullable: true }) proofNote!: string | null;
  @Column({ type: 'varchar', length: 80, name: 'proof_reference', nullable: true }) proofReference!: string | null;
  @Column({ type: 'varchar', length: 120, name: 'proof_authority', nullable: true }) proofAuthority!: string | null;
  @Column({ type: 'uuid', name: 'proof_file_id', nullable: true }) proofFileId!: string | null;
  @Column({ type: 'uuid', name: 'proof_approved_by', nullable: true }) proofApprovedBy!: string | null;
  @Column({ ...ts, name: 'proof_approved_at', nullable: true }) proofApprovedAt!: Date | null;
}

@Entity('device_photos')
export class DevicePhoto {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'tenant_id' }) tenantId!: string;
  @Column({ type: 'uuid', name: 'device_id' }) deviceId!: string;
  @Column({ type: 'uuid', name: 'file_id' }) fileId!: string;
  @Column({ ...ts, name: 'created_at', default: () => 'now()' }) createdAt!: Date;
}

@Entity('device_flags')
export class DeviceFlag {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'tenant_id' }) tenantId!: string;
  @Column({ type: 'uuid', name: 'device_id' }) deviceId!: string;
  @Column({ type: 'varchar', length: 20 }) type!: FlagType;
  @Column({ type: 'varchar', length: 80, nullable: true }) reference!: string | null;
  @Column({ type: 'varchar', length: 500 }) note!: string;
  @Column({ type: 'uuid', name: 'raised_by' }) raisedBy!: string;
  @Column({ type: 'varchar', length: 120, name: 'raised_by_name' }) raisedByName!: string;
  @Column({ ...ts, name: 'raised_at', default: () => 'now()' }) raisedAt!: Date;
  @Column({ ...ts, name: 'resolved_at', nullable: true }) resolvedAt!: Date | null;
  @Column({ type: 'uuid', name: 'resolved_by', nullable: true }) resolvedBy!: string | null;
  @Column({ type: 'varchar', length: 120, name: 'resolved_by_name', nullable: true }) resolvedByName!: string | null;
  @Column({ type: 'varchar', length: 24, nullable: true }) outcome!: FlagOutcome | null;
  @Column({ type: 'varchar', length: 500, name: 'resolution_note', nullable: true }) resolutionNote!: string | null;
}

@Entity('device_events')
export class DeviceEvent {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'tenant_id' }) tenantId!: string;
  @Column({ type: 'uuid', name: 'device_id' }) deviceId!: string;
  @Column({ type: 'varchar', length: 24 }) type!: string;
  @Column({ type: 'varchar', length: 160 }) title!: string;
  @Column({ type: 'varchar', length: 300, nullable: true }) detail!: string | null;
  @Column({ type: 'uuid', name: 'actor_id', nullable: true }) actorId!: string | null;
  @Column({ type: 'varchar', length: 120, name: 'actor_name' }) actorName!: string;
  @Column({ ...ts, name: 'created_at', default: () => 'now()' }) createdAt!: Date;
}

export const ENTITIES = [Tenant, Shop, User, Session, UserToken, Settings, AuditLog, IdempotencyKey, PlatformAdmin, StoredFileRow, Seller, Purchase, Device, DevicePhoto, DeviceFlag, DeviceEvent];
