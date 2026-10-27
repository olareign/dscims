import { Column, PrimaryGeneratedColumn } from 'typeorm';

// PRD section 7: every business table carries tenant_id, created_at, created_by and updated_at.
// Every query must filter by tenantId; Postgres row-level security backs this up (AUTH-1).
export abstract class TenantScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy!: string | null;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'now()' })
  updatedAt!: Date;
}
