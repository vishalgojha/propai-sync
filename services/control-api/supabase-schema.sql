-- Supabase schema for PropAi Sync control-api
-- Apply in Supabase SQL editor before switching CONTROL_API to Supabase.

create table if not exists tenants (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id text primary key,
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists memberships (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table if not exists invites (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  email text not null,
  role text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create table if not exists whatsapp_identities (
  phone text primary key,
  user_id text not null references users(id) on delete cascade,
  tenant_id text not null references tenants(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists tenant_settings (
  tenant_id text primary key references tenants(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists usage_events (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  provider text not null,
  model text not null,
  kind text not null,
  input_tokens integer,
  output_tokens integer,
  cache_read_tokens integer,
  cache_write_tokens integer,
  total_tokens integer,
  characters integer,
  latency_ms integer,
  session_id text,
  run_id text,
  source text,
  created_at timestamptz not null default now()
);

create index if not exists idx_usage_events_tenant_created
  on usage_events (tenant_id, created_at);

create index if not exists idx_usage_events_tenant_kind
  on usage_events (tenant_id, kind);
