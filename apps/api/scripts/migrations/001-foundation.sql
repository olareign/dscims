-- Phase 1 foundation: tenants, shops, users, sessions, tokens, settings, audit log, platform admins, idempotency keys.
-- Forward-only. Every tenant table has row-level security keyed on app.tenant_id (AUTH-1).

DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dscims_app') THEN
    CREATE ROLE dscims_app NOLOGIN NOBYPASSRLS;
  END IF;
END $$;
GRANT dscims_app TO CURRENT_USER;

CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL,
  status varchar(12) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  grace_ends_at timestamptz,
  onboarded_at timestamptz,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name varchar(120) NOT NULL,
  address varchar(300) NOT NULL DEFAULT '',
  latitude double precision,
  longitude double precision,
  phone varchar(30),
  is_main boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX shops_tenant_name_uq ON shops (tenant_id, lower(name));

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  shop_id uuid REFERENCES shops(id),
  name varchar(120) NOT NULL,
  email varchar(254) NOT NULL,
  password_hash varchar(100),
  role varchar(10) NOT NULL CHECK (role IN ('owner', 'manager', 'staff')),
  status varchar(12) NOT NULL DEFAULT 'invited' CHECK (status IN ('active', 'invited', 'deactivated')),
  last_sign_in_at timestamptz,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Sign-in is by email alone, so an email belongs to exactly one account across all dealers.
CREATE UNIQUE INDEX users_email_uq ON users (lower(email));
CREATE INDEX users_tenant_idx ON users (tenant_id, status);
CREATE INDEX users_shop_idx ON users (shop_id);

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  user_id uuid NOT NULL REFERENCES users(id),
  ip varchar(64),
  user_agent varchar(300),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX sessions_user_idx ON sessions (user_id) WHERE revoked_at IS NULL;

CREATE TABLE user_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  user_id uuid NOT NULL REFERENCES users(id),
  type varchar(10) NOT NULL CHECK (type IN ('invite', 'reset')),
  token_hash char(64) NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX user_tokens_hash_uq ON user_tokens (token_hash);

CREATE TABLE settings (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id),
  discount_limit_percent integer NOT NULL DEFAULT 5 CHECK (discount_limit_percent BETWEEN 0 AND 100),
  credit_due_days integer NOT NULL DEFAULT 30 CHECK (credit_due_days IN (14, 30, 60)),
  receipt_text text NOT NULL DEFAULT 'This receipt is a record of sale. It does not prove a device is not stolen.',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  actor_id uuid,
  actor_name varchar(120) NOT NULL,
  actor_role varchar(10),
  action varchar(60) NOT NULL,
  category varchar(12) NOT NULL CHECK (category IN ('sign_in', 'security', 'user', 'settings')),
  message varchar(300) NOT NULL,
  entity_type varchar(30),
  entity_id uuid,
  entity_label varchar(160),
  shop_id uuid,
  shop_name varchar(120),
  before jsonb,
  after jsonb,
  ip varchar(64),
  user_agent varchar(300),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_tenant_time_idx ON audit_log (tenant_id, created_at DESC);
CREATE INDEX audit_tenant_category_idx ON audit_log (tenant_id, category, created_at DESC);

-- AUTH-5 / TRACE-3: entries are append-only, even for the table owner.
CREATE FUNCTION audit_log_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END $$;
CREATE TRIGGER audit_log_no_update BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable();

CREATE TABLE idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  user_id uuid NOT NULL,
  key varchar(120) NOT NULL,
  request_hash char(64) NOT NULL,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idempotency_uq ON idempotency_keys (tenant_id, user_id, key);

CREATE TABLE platform_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(254) NOT NULL,
  name varchar(120) NOT NULL,
  password_hash varchar(100) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX platform_admins_email_uq ON platform_admins (lower(email));

-- Row-level security. The API switches to dscims_app and sets app.tenant_id for every tenant request;
-- login, token redemption and the platform console use the owner connection instead.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['shops', 'users', 'sessions', 'user_tokens', 'settings', 'audit_log', 'idempotency_keys'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid)',
      t);
  END LOOP;
END $$;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenants
  USING (id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (id = nullif(current_setting('app.tenant_id', true), '')::uuid);

GRANT USAGE ON SCHEMA public TO dscims_app;
GRANT SELECT, UPDATE ON tenants TO dscims_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON shops, users, sessions, user_tokens, settings, idempotency_keys TO dscims_app;
GRANT SELECT, INSERT ON audit_log TO dscims_app;
