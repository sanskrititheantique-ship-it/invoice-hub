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

-- Internships (LoudCousin): offer letters, agreements, completion certificates.
-- payload = {"fields": {...}, "show": {...}, "terms": [...]} — see lib/internship-fields.ts.
-- ref_code "2607/SW62" prints as LC/INT/2607/SW62 (certificate: LC/CERT/2607/SW62).
create table if not exists internships (
  id          uuid primary key default gen_random_uuid(),
  biz         text not null,
  ref_code    text not null unique,
  intern_name text not null,
  status      text not null default 'active' check (status in ('draft','active','completed','ended')),
  payload     jsonb not null default '{}'::jsonb,
  created_by  text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists internships_biz_idx on internships (biz, created_at desc);

-- One row per PDF opened, with a frozen copy of exactly what it said.
create table if not exists internship_documents (
  id            bigserial primary key,
  internship_id uuid not null references internships(id) on delete cascade,
  biz           text not null,
  kind          text not null check (kind in ('offer','agreement','both','certificate')),
  ref_no        text not null,
  snapshot      jsonb not null,
  created_by    text not null default '',
  created_at    timestamptz not null default now()
);
create index if not exists internship_documents_idx on internship_documents (internship_id, created_at desc);

-- First intern, as issued on 23 Nov 2026. Only added if that reference doesn't exist yet.
insert into internships (biz, ref_code, intern_name, status, payload, created_by)
select 'loudcousin', '2607/SW62', 'Rahul Kumar', 'active', $json${
  "fields": {
    "internName": "Rahul Kumar", "salutation": "Rahul", "course": "B.Tech", "year": "3rd Year",
    "college": "Newton School of Technology, Rishihood University", "city": "Sonipat, Haryana",
    "email": "rahul.kumar2024@nst.rishihood.edu.in",
    "role": "Founder’s Office Intern (Tech & Operations)", "startDate": "2026-07-10",
    "endDate": "Ongoing, until ended with notice", "duration": "Ongoing", "mode": "Hybrid",
    "hours": "Flexible, as agreed with the Founder", "reportsTo": "Deepanshu Tyagi (Founder)",
    "stipend": "₹15,000 per month", "stipendPaidOn": "Monthly, via UPI", "incentive": "None",
    "trialPeriod": "First 7 days", "noticePeriod": "7 days' written notice, either side",
    "leave": "As agreed with the Founder, with prior notice", "letterDate": "2026-07-10",
    "whyUs": "You'll be working directly with the Founder. We liked how well you handle people and how sharp your tech and web design skills are. You'll fit right in with how we work: fun on top, serious work underneath.",
    "roleSummary": "You'll own our website and tech, coordinate with clients and the team, and handle documentation.",
    "responsibilities": "Managing LoudCousin’s website and tech, coordinating with clients and the team, handling documentation, and supporting the Founder across operations",
    "certIssueDate": "2026-11-23"
  },
  "show": { "incentive": true, "phone": false }
}$json$::jsonb, 'seed'
where not exists (select 1 from internships where ref_code = '2607/SW62');
