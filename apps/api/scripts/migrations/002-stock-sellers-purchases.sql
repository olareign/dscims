-- Phase 2: private files, sellers, purchases, devices with flags and an append-only timeline.
-- Forward-only. Every table has tenant_id and row-level security (AUTH-1).

ALTER TABLE audit_log DROP CONSTRAINT audit_log_category_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_category_check CHECK (category IN ('sign_in', 'security', 'user', 'settings', 'stock'));

CREATE TABLE files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  kind varchar(12) NOT NULL CHECK (kind IN ('seller_id', 'device_photo', 'proof')),
  storage_key varchar(300) NOT NULL,
  resource_type varchar(12),
  format varchar(12),
  filename varchar(200) NOT NULL,
  mime varchar(100) NOT NULL,
  bytes integer NOT NULL CHECK (bytes > 0),
  content_hash char(64) NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX files_tenant_idx ON files (tenant_id, created_at DESC);

CREATE TABLE sellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name varchar(120) NOT NULL,
  phone varchar(11) NOT NULL,
  address varchar(300) NOT NULL,
  -- SELL-1: NIN and BVN are encrypted with FIELD_ENCRYPTION_KEY; only the last 4 digits are kept readable.
  nin_encrypted text,
  nin_last4 char(4),
  bvn_encrypted text,
  bvn_last4 char(4),
  id_file_id uuid REFERENCES files(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX sellers_tenant_phone_uq ON sellers (tenant_id, phone);
CREATE INDEX sellers_tenant_name_idx ON sellers (tenant_id, lower(name));

CREATE TABLE purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  shop_id uuid NOT NULL REFERENCES shops(id),
  seller_id uuid NOT NULL REFERENCES sellers(id),
  number integer NOT NULL,
  payment_method varchar(10) NOT NULL CHECK (payment_method IN ('cash', 'transfer', 'part')),
  total_kobo bigint NOT NULL CHECK (total_kobo > 0),
  paid_kobo bigint NOT NULL CHECK (paid_kobo >= 0 AND paid_kobo <= total_kobo),
  declared_by varchar(120) NOT NULL,
  declared_at timestamptz NOT NULL,
  created_by uuid NOT NULL,
  created_by_name varchar(120) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX purchases_tenant_number_uq ON purchases (tenant_id, number);
CREATE INDEX purchases_seller_idx ON purchases (tenant_id, seller_id, created_at DESC);

CREATE TABLE devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  shop_id uuid NOT NULL REFERENCES shops(id),
  purchase_id uuid REFERENCES purchases(id),
  seller_id uuid REFERENCES sellers(id),
  brand varchar(60) NOT NULL,
  model varchar(80) NOT NULL,
  storage varchar(20),
  colour varchar(40),
  imei char(15) NOT NULL,
  condition varchar(14) NOT NULL CHECK (condition IN ('brand_new', 'uk_used', 'nigeria_used', 'open_box', 'refurbished', 'faulty')),
  status varchar(14) NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'reserved', 'sold', 'returned', 'under_review', 'flagged', 'written_off')),
  -- INV-8: "Cleared" puts the device back where it was before the flag.
  status_before_flag varchar(14),
  cost_kobo bigint NOT NULL CHECK (cost_kobo > 0),
  selling_kobo bigint NOT NULL CHECK (selling_kobo > 0),
  proof_type varchar(34) NOT NULL DEFAULT 'receipt' CHECK (proof_type IN ('receipt', 'certificate_of_ownership', 'police_or_government_credentials')),
  proof_note varchar(300),
  proof_reference varchar(80),
  proof_authority varchar(120),
  proof_file_id uuid REFERENCES files(id),
  proof_approved_by uuid,
  proof_approved_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- INV-1: a duplicate IMEI within a dealer is blocked.
CREATE UNIQUE INDEX devices_tenant_imei_uq ON devices (tenant_id, imei);
CREATE INDEX devices_list_idx ON devices (tenant_id, status, created_at DESC);
CREATE INDEX devices_shop_idx ON devices (tenant_id, shop_id, status);
CREATE INDEX devices_seller_idx ON devices (tenant_id, seller_id);
CREATE INDEX devices_search_idx ON devices (tenant_id, lower(model), lower(brand));

CREATE TABLE device_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  device_id uuid NOT NULL REFERENCES devices(id),
  file_id uuid NOT NULL REFERENCES files(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX device_photos_uq ON device_photos (device_id, file_id);

CREATE TABLE device_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  device_id uuid NOT NULL REFERENCES devices(id),
  type varchar(20) NOT NULL CHECK (type IN ('reported_stolen', 'police_case', 'government_case', 'security_concern', 'customer_complaint', 'other')),
  reference varchar(80),
  note varchar(500) NOT NULL,
  raised_by uuid NOT NULL,
  raised_by_name varchar(120) NOT NULL,
  raised_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid,
  resolved_by_name varchar(120),
  outcome varchar(24) CHECK (outcome IN ('cleared', 'released_to_authority', 'written_off')),
  resolution_note varchar(500)
);
CREATE INDEX device_flags_device_idx ON device_flags (device_id, raised_at DESC);
-- One open flag per device at a time.
CREATE UNIQUE INDEX device_flags_open_uq ON device_flags (device_id) WHERE resolved_at IS NULL;

CREATE TABLE device_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  device_id uuid NOT NULL REFERENCES devices(id),
  type varchar(24) NOT NULL,
  title varchar(160) NOT NULL,
  detail varchar(300),
  actor_id uuid,
  actor_name varchar(120) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX device_events_device_idx ON device_events (device_id, created_at DESC);

-- TRACE-3: the device timeline is append-only, even for the table owner.
CREATE FUNCTION device_events_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'device_events is append-only';
END $$;
CREATE TRIGGER device_events_no_update BEFORE UPDATE OR DELETE ON device_events
  FOR EACH ROW EXECUTE FUNCTION device_events_immutable();
CREATE TRIGGER device_events_no_truncate BEFORE TRUNCATE ON device_events
  FOR EACH STATEMENT EXECUTE FUNCTION device_events_immutable();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['files', 'sellers', 'purchases', 'devices', 'device_photos', 'device_flags', 'device_events'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid)',
      t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE ON files, sellers, purchases, devices, device_flags TO dscims_app;
GRANT SELECT, INSERT, DELETE ON device_photos TO dscims_app;
GRANT SELECT, INSERT ON device_events TO dscims_app;
