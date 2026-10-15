-- Invoice Hub schema. Safe to run more than once.

create extension if not exists pgcrypto;

create table if not exists users (
  id            serial primary key,
  email         text not null unique,
  name          text not null default '',
  password_hash text not null,
  -- {"*":"admin"} = every business; {"sanskriti":"editor"} = one business
  access        jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create table if not exists business_settings (
  biz        text primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists catalog_items (
  id      serial primary key,
  biz     text not null,
  name    text not null,
  hsn     text not null default '',
  gst     numeric(5,2) not null default 18,
  apparel boolean not null default false,
  price   numeric(14,2) not null default 0,
  unit    text not null default 'Nos',
  note    text not null default '',
  active  boolean not null default true
);
create index if not exists catalog_biz_idx on catalog_items (biz, active);

-- One row per number series, origin (G = generator, W = website) and financial year.
create table if not exists counters (
  code   text not null,
  origin text not null,
  fy     text not null,
  seq    integer not null default 0,
  primary key (code, origin, fy)
);

create table if not exists invoices (
  id            uuid primary key default gen_random_uuid(),
  biz           text not null,
  series        text not null,
  doc_type      text not null default 'invoice' check (doc_type in ('invoice','credit_note')),
  origin        text not null default 'G',
  fy            text not null,
  seq           integer not null,
  number        text not null unique,
  date          date not null,
  status        text not null default 'issued' check (status in ('issued','partial','paid','cancelled')),
  customer_name text not null default '',
  customer      jsonb not null default '{}'::jsonb,
  data          jsonb not null,
  totals        jsonb not null,
  currency      text not null default 'INR',
  fx            numeric(14,4) not null default 1,
  taxable       numeric(14,2) not null default 0,
  tax           numeric(14,2) not null default 0,
  grand         numeric(14,2) not null default 0,
  paid          numeric(14,2) not null default 0,
  b2b           boolean not null default false,
  pos_code      text not null default '',
  channel       text not null default '',
  order_id      text not null default '',
  external_id   text,
  ref_invoice_id uuid references invoices(id),
  share_token   text unique,
  cancel_reason text,
  created_by    text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists invoices_biz_date_idx on invoices (biz, date desc, seq desc);
create index if not exists invoices_biz_fy_idx on invoices (biz, fy);
create index if not exists invoices_ref_idx on invoices (ref_invoice_id);
create unique index if not exists invoices_external_idx on invoices (biz, external_id) where external_id is not null;

create table if not exists payments (
  id         serial primary key,
  invoice_id uuid not null references invoices(id) on delete cascade,
  date       date not null,
  amount     numeric(14,2) not null check (amount > 0),
  mode       text not null default '',
  ref        text not null default '',
  note       text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists payments_invoice_idx on payments (invoice_id);

create table if not exists audit_log (
  id         bigserial primary key,
  biz        text not null,
  invoice_id uuid,
  actor      text not null default '',
  action     text not null,
  detail     jsonb not null default '{}'::jsonb,
  at         timestamptz not null default now()
);
create index if not exists audit_invoice_idx on audit_log (invoice_id, at desc);

create table if not exists api_keys (
  id         serial primary key,
  biz        text not null,
  name       text not null,
  prefix     text not null,
  key_hash   text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
