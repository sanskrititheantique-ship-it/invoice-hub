import "server-only";
import crypto from "node:crypto";
import { db } from "./db";
import { brandOf } from "./brands";
import { UserError, audit } from "./invoices";
import type { Settings } from "./tax";
import {
  Internship,
  InternshipPayload,
  InternshipStatus,
  REF_ALPHABET,
  STATUSES,
  defaultPayload,
  formatRef,
  normaliseInternship,
  yymmFrom,
} from "./internship-fields";
import type { DocKind } from "./internship-sheets";

const fail = (m: string): never => {
  throw new UserError(m);
};

/** Businesses that have the Internships section (lib/brands.ts → internships: true). */
export function internshipsEnabled(biz: string) {
  return !!brandOf(biz)?.internships;
}
const mustEnabled = (biz: string) => internshipsEnabled(biz) || fail("Internships aren't turned on for this business.");

// The tables this feature needs, copied from db/schema.sql. Created on first
// use so the feature works straight after a deploy, even if
// `npm run db:migrate` hasn't been run. Every statement is "if not exists" /
// "where not exists", so this is safe on a database that already has them.
const SCHEMA = `
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
select 'loudcousin', '2607/SW62', 'Rahul Kumar', 'active', $json\${
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
`;
let ready: Promise<void> | null = null;
function ensureTables(): Promise<void> {
  if (!ready) {
    ready = db()
      .unsafe(SCHEMA)
      .then(() => undefined)
      .catch((e) => {
        // Another server instance created them a moment earlier: that's fine.
        if (["23505", "42P07", "42710"].includes((e as { code?: string }).code || "")) return;
        ready = null; // anything else: try again on the next request
        throw e;
      });
  }
  return ready;
}

type Row = {
  id: string;
  biz: string;
  ref_code: string;
  intern_name: string;
  status: InternshipStatus;
  payload: unknown;
  created_by: string;
  created_at: string;
  updated_at: string;
};

const toInternship = (r: Row): Internship => ({
  id: r.id,
  refCode: r.ref_code,
  status: r.status,
  payload: normaliseInternship(r.payload),
  createdAt: String(r.created_at),
  updatedAt: String(r.updated_at),
});

/** A new record's starting values, with this business's saved details
 *  (Settings page) taking the place of the built-in defaults. */
export function newPayload(settings: Settings): InternshipPayload {
  const p = defaultPayload();
  const pick = (k: string, from: string) => {
    const x = (settings[from] || "").trim();
    if (x) p.fields[k] = x;
  };
  pick("gstin", "gstin");
  pick("contactEmail", "email");
  pick("website", "website");
  pick("entity", "legalName");
  pick("signatoryName", "signatory");
  return p;
}

export type ListRow = {
  id: string;
  refCode: string;
  internName: string;
  status: InternshipStatus;
  role: string;
  startDate: string;
  docs: number;
  updatedAt: string;
};

export async function listInternships(biz: string): Promise<ListRow[]> {
  mustEnabled(biz);
  await ensureTables();
  const rows = await db()<
    { id: string; ref_code: string; intern_name: string; status: InternshipStatus; role: string | null; start_date: string | null; docs: number; updated_at: string }[]
  >`
    select i.id, i.ref_code, i.intern_name, i.status,
           i.payload->'fields'->>'role' as role,
           i.payload->'fields'->>'startDate' as start_date,
           (select count(*)::int from internship_documents d where d.internship_id = i.id) as docs,
           i.updated_at
    from internships i
    where i.biz = ${biz}
    order by i.created_at desc`;
  return rows.map((r) => ({
    id: r.id,
    refCode: r.ref_code,
    internName: r.intern_name,
    status: r.status,
    role: r.role || "",
    startDate: r.start_date || "",
    docs: r.docs,
    updatedAt: String(r.updated_at),
  }));
}

export async function getInternship(biz: string, id: string): Promise<Internship | null> {
  mustEnabled(biz);
  await ensureTables();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [r] = await db()<Row[]>`select * from internships where biz = ${biz} and id = ${id}`;
  return r ? toInternship(r) : null;
}

/** Which business a record belongs to — the print page only has the id. */
export async function bizOfInternship(id: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  await ensureTables();
  const [r] = await db()<{ biz: string }[]>`select biz from internships where id = ${id}`;
  return r?.biz ?? null;
}

function check(payload: InternshipPayload, status: string) {
  if (!payload.fields.internName.trim()) fail("Add the intern's full name.");
  if (!payload.fields.role.trim()) fail("Add the role.");
  if (!STATUSES.includes(status as InternshipStatus)) fail("Pick a status.");
}

function randomCode() {
  let s = "";
  for (let i = 0; i < 4; i++) s += REF_ALPHABET[crypto.randomInt(REF_ALPHABET.length)];
  return s;
}

export async function createInternship(biz: string, raw: unknown, status: string, actor: string) {
  mustEnabled(biz);
  await ensureTables();
  const payload = normaliseInternship(raw);
  check(payload, status);
  const yymm = yymmFrom(payload.fields.startDate);
  const sql = db();
  // 31^4 ≈ 923k codes per month; a clash is rare, and the unique index is
  // the real guard, so just try again with a fresh code.
  for (let attempt = 0; attempt < 8; attempt++) {
    const refCode = `${yymm}/${randomCode()}`;
    try {
      const id = await sql.begin(async (tx) => {
        const [r] = await tx<{ id: string }[]>`
          insert into internships (biz, ref_code, intern_name, status, payload, created_by)
          values (${biz}, ${refCode}, ${payload.fields.internName.trim()}, ${status}, ${tx.json(payload as never)}, ${actor})
          returning id`;
        await audit(tx, biz, null, actor, "internship.create", { internship: r.id, ref: formatRef(refCode), name: payload.fields.internName.trim() });
        return r.id;
      });
      return { id, refCode };
    } catch (e) {
      if ((e as { code?: string }).code === "23505") continue;
      throw e;
    }
  }
  return fail("Couldn't make a unique reference number. Try saving again.");
}

export async function updateInternship(biz: string, id: string, raw: unknown, status: string, actor: string) {
  mustEnabled(biz);
  await ensureTables();
  const payload = normaliseInternship(raw);
  check(payload, status);
  const sql = db();
  return sql.begin(async (tx) => {
    const [r] = await tx<{ ref_code: string }[]>`
      update internships
      set intern_name = ${payload.fields.internName.trim()}, status = ${status}, payload = ${tx.json(payload as never)}, updated_at = now()
      where biz = ${biz} and id = ${id}
      returning ref_code`;
    if (!r) fail("This internship no longer exists.");
    await audit(tx, biz, null, actor, "internship.update", { internship: id, ref: formatRef(r.ref_code), status });
    return { id, refCode: r.ref_code };
  });
}

/** Every PDF made is recorded with a frozen copy of what it said. */
export async function logDocument(biz: string, internship: Internship, kind: DocKind, actor: string) {
  await ensureTables();
  await db()`
    insert into internship_documents (internship_id, biz, kind, ref_no, snapshot, created_by)
    values (${internship.id}, ${biz}, ${kind}, ${formatRef(internship.refCode)}, ${db().json(internship.payload as never)}, ${actor})`;
}

export type DocLogRow = { id: number; kind: DocKind; refNo: string; createdBy: string; createdAt: string };
export async function listDocuments(biz: string, internshipId: string): Promise<DocLogRow[]> {
  await ensureTables();
  const rows = await db()<{ id: number; kind: DocKind; ref_no: string; created_by: string; created_at: string }[]>`
    select id, kind, ref_no, created_by, created_at from internship_documents
    where biz = ${biz} and internship_id = ${internshipId}
    order by created_at desc limit 50`;
  return rows.map((r) => ({ id: r.id, kind: r.kind, refNo: r.ref_no, createdBy: r.created_by, createdAt: String(r.created_at) }));
}
