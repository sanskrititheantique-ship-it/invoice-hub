import "server-only";
import crypto from "node:crypto";
import QRCode from "qrcode";
import type postgres from "postgres";
import { db } from "./db";
import { Brand, brandOf, seriesOf } from "./brands";
import { Draft, Settings, calc, creditCode, fyOf, numFmt, r2, todayISO, validate } from "./tax";
import { LayoutPatch, sanitizePatch, validImage } from "./layout";
import { upiUri } from "./sheets";

type Tx = postgres.TransactionSql | postgres.Sql;
export type DocType = "invoice" | "credit_note";
export type Status = "issued" | "partial" | "paid" | "cancelled";
export type InvoiceRow = {
  id: string; biz: string; series: string; doc_type: DocType; origin: string; fy: string; seq: number; number: string;
  date: string; status: Status; customer_name: string; data: Draft; totals: Record<string, number>; currency: string; fx: number;
  taxable: number; tax: number; grand: number; paid: number; b2b: boolean; pos_code: string; channel: string; order_id: string;
  external_id: string | null; ref_invoice_id: string | null; share_token: string | null; cancel_reason: string | null;
  created_by: string; created_at: string; updated_at: string; credited?: number;
};
export type Payment = { id: number; date: string; amount: number; mode: string; ref: string; note: string; created_by: string; created_at: string };

export class UserError extends Error {}
const fail = (m: string): never => { throw new UserError(m); };
const mustBrand = (biz: string) => brandOf(biz) || fail("Unknown business.");

/* ---------- settings & catalog ---------- */
export async function getSettings(biz: string): Promise<Settings> {
  const brand = mustBrand(biz);
  const [row] = await db()`select data from business_settings where biz = ${biz}`;
  return { ...(brand.business as unknown as Settings), ...((row?.data as Settings) || {}) };
}
export const BUSINESS_KEYS = ["legalName", "tradeName", "gstin", "phone", "email", "website", "signatory", "stateCode", "address", "terms",
  "bankName", "accName", "account", "ifsc", "upi", "swift", "lut"];
// Merges into the stored settings, so saving one section never wipes another.
async function mergeSettings(biz: string, data: Record<string, string>) {
  await db()`insert into business_settings (biz, data, updated_at) values (${biz}, ${db().json(data)}, now())
    on conflict (biz) do update set data = business_settings.data || excluded.data, updated_at = now()`;
}
export async function saveSettings(biz: string, data: Settings, actor: string) {
  mustBrand(biz);
  const clean = Object.fromEntries(BUSINESS_KEYS.map((k) => [k, String(data[k] ?? "").trim().slice(0, 2000)]));
  await mergeSettings(biz, clean);
  await audit(db(), biz, null, actor, "settings.update", { fields: BUSINESS_KEYS.filter((k) => data[k] !== undefined) });
}
export async function saveLayout(biz: string, input: { layout: LayoutPatch; logoImg: string; sigImg: string }, actor: string) {
  mustBrand(biz);
  for (const [name, img] of [["Logo", input.logoImg], ["Signature", input.sigImg]] as const)
    if (img && !validImage(img)) fail(`${name} must be a PNG, JPG or WebP image under 300 KB.`);
  const layout = sanitizePatch(input.layout);
  await mergeSettings(biz, { layout: JSON.stringify(layout), logoImg: input.logoImg || "", sigImg: input.sigImg || "" });
  await audit(db(), biz, null, actor, "layout.update", { sig: layout.sig, hidden: Object.entries(layout.show || {}).filter(([, on]) => !on).map(([k]) => k) });
}
export type CatalogItem = { id?: number; name: string; hsn: string; gst: number; apparel: boolean; price: number; unit: string; note: string };
export async function listCatalog(biz: string): Promise<CatalogItem[]> {
  return db()<CatalogItem[]>`select id, name, hsn, gst, apparel, price, unit, note from catalog_items where biz = ${biz} and active order by name`;
}
export async function saveCatalog(biz: string, items: CatalogItem[], actor: string) {
  mustBrand(biz);
  const clean = items.filter((i) => i.name?.trim()).map((i) => ({ biz, name: i.name.trim().slice(0, 200), hsn: String(i.hsn || "").trim(), gst: Number(i.gst) || 0, apparel: !!i.apparel, price: Number(i.price) || 0, unit: i.unit || "Nos", note: String(i.note || "") }));
  await db().begin(async (tx) => {
    await tx`update catalog_items set active = false where biz = ${biz}`;
    if (clean.length) await tx`insert into catalog_items ${tx(clean, "biz", "name", "hsn", "gst", "apparel", "price", "unit", "note")}`;
  });
  await audit(db(), biz, null, actor, "catalog.update", { count: clean.length });
}
export async function recentCustomers(biz: string) {
  return db()<{ customer: Draft["customer"]; storeName: string; sellerId: string }[]>`
    select customer, coalesce(data->>'storeName','') as "storeName", coalesce(data->>'sellerId','') as "sellerId" from (
      select distinct on (lower(customer_name)) customer, data, created_at from invoices
      where biz = ${biz} and customer_name <> '' order by lower(customer_name), created_at desc
    ) t order by created_at desc limit 300`;
}

/* ---------- numbering ---------- */
async function nextSeq(tx: Tx, code: string, origin: string, fy: string) {
  // Atomic: the row lock serialises concurrent saves, and a failed insert rolls the counter back.
  const [r] = await tx<{ seq: number }[]>`insert into counters (code, origin, fy, seq) values (${code}, ${origin}, ${fy}, 1)
    on conflict (code, origin, fy) do update set seq = counters.seq + 1 returning seq`;
  return r.seq;
}
export async function peekNext(code: string, origin: string, fy: string) {
  const [r] = await db()<{ seq: number }[]>`select seq from counters where code = ${code} and origin = ${origin} and fy = ${fy}`;
  return numFmt(code, origin, fy, (r?.seq || 0) + 1);
}
export async function seriesStatus(biz: string) {
  const brand = mustBrand(biz); const fy = fyOf();
  const out: { code: string; label: string; origin: string; next: string; used: number }[] = [];
  for (const s of brand.series) for (const code of [s.code, creditCode(s.code)]) for (const origin of ["G", "W"]) {
    const [r] = await db()<{ seq: number }[]>`select seq from counters where code = ${code} and origin = ${origin} and fy = ${fy}`;
    out.push({ code, label: code === s.code ? s.label : s.label + " · credit notes", origin, next: numFmt(code, origin, fy, (r?.seq || 0) + 1), used: r?.seq || 0 });
  }
  return out;
}
export async function setNextNumber(biz: string, code: string, origin: string, next: number, actor: string) {
  const brand = mustBrand(biz);
  if (!brand.series.some((s) => s.code === code || creditCode(s.code) === code)) fail("Unknown series.");
  if (!["G", "W"].includes(origin)) fail("Origin must be G or W.");
  if (!(Number.isInteger(next) && next >= 1 && next <= 99999)) fail("Enter a whole number from 1 to 99999.");
  const fy = fyOf();
  const [m] = await db()<{ max: number | null }[]>`select max(seq)::int as max from invoices where number like ${code + "/" + origin + "/" + fy + "/%"}`;
  if (next <= (m?.max || 0)) fail(`Number ${next} is already used. The next free number is ${(m?.max || 0) + 1}.`);
  await db()`insert into counters (code, origin, fy, seq) values (${code}, ${origin}, ${fy}, ${next - 1}) on conflict (code, origin, fy) do update set seq = excluded.seq`;
  await audit(db(), biz, null, actor, "series.set", { code, origin, fy, next });
}

/* ---------- create / update ---------- */
function prepare(brand: Brand, settings: Settings, draft: Draft) {
  const d: Draft = { ...draft, customer: { ...draft.customer, gstin: (draft.customer?.gstin || "").toUpperCase().trim() } };
  d.layout = sanitizePatch(draft.layout);
  if (!d.layout.show && !d.layout.sig && d.layout.sigText === undefined && d.layout.thanks === undefined) delete d.layout;
  seriesOf(brand, d.series); // falls back to the first series if unknown
  if (!brand.series.some((s) => s.code === d.series)) d.series = brand.series[0].code;
  const c = calc(d, brand, settings.stateCode || brand.business.stateCode);
  const err = validate(d, c);
  if (err) fail(err);
  const totals = { taxable: c.taxable, cgst: c.cgst, sgst: c.sgst, igst: c.igst, tax: c.tax, roundOff: c.roundOff, grand: c.grand, advance: c.advance, inr: c.inr ?? 0 };
  return { d, c, totals };
}

export async function createDoc(opts: { biz: string; draft: Draft; actor: string; origin?: "G" | "W"; docType?: DocType; refId?: string; externalId?: string | null }) {
  const brand = mustBrand(opts.biz); const settings = await getSettings(opts.biz);
  const origin = opts.origin || "G"; const docType = opts.docType || "invoice";
  const { d, c, totals } = prepare(brand, settings, opts.draft);
  const fy = fyOf(d.date);
  try {
    return await insertDoc(opts, d, c, totals, fy, origin, docType);
  } catch (e) {
    // Two requests with the same externalId raced: the unique index stopped the second one. Return the winner.
    if (opts.externalId && (e as { code?: string }).code === "23505") {
      const [ex] = await db()<InvoiceRow[]>`select * from invoices where biz = ${opts.biz} and external_id = ${opts.externalId}`;
      if (ex) return { row: ex, existing: true };
    }
    throw e;
  }
}

async function insertDoc(opts: { biz: string; actor: string; refId?: string; externalId?: string | null }, d: Draft, c: ReturnType<typeof calc>, totals: Record<string, number>, fy: string, origin: string, docType: DocType) {
  return db().begin(async (tx) => {
    if (opts.externalId) {
      const [ex] = await tx<InvoiceRow[]>`select * from invoices where biz = ${opts.biz} and external_id = ${opts.externalId}`;
      if (ex) return { row: ex, existing: true };
    }
    let ref: InvoiceRow | undefined;
    if (docType === "credit_note") {
      [ref] = await tx<InvoiceRow[]>`select * from invoices where id = ${opts.refId || null} and biz = ${opts.biz} for update`;
      if (!ref || ref.doc_type !== "invoice") fail("Choose the invoice this credit note is against.");
      if (ref!.status === "cancelled") fail("That invoice is cancelled. Cancelled invoices don't need a credit note.");
      if (ref!.currency !== (d.currency || "INR")) fail("A credit note must use the same currency as its invoice.");
      const [cr] = await tx<{ s: number }[]>`select coalesce(sum(grand),0) as s from invoices where ref_invoice_id = ${ref!.id} and status <> 'cancelled'`;
      const room = r2(ref!.grand - Number(cr.s));
      if (c.grand > room + 0.001) fail(`This credit note can be at most ${room.toFixed(2)}, the amount not yet credited on ${ref!.number}.`);
      if (d.date < String(ref!.date).slice(0, 10)) fail("A credit note can't be dated before its invoice.");
      d.status = "issued"; d.advance = "";
    }
    const code = docType === "credit_note" ? creditCode(d.series) : d.series;
    const seq = await nextSeq(tx, code, origin, fy);
    const number = numFmt(code, origin, fy, seq);
    const [row] = await tx<InvoiceRow[]>`insert into invoices ${tx({
      biz: opts.biz, series: d.series, doc_type: docType, origin, fy, seq, number, date: d.date, status: "issued",
      customer_name: d.customer.name.trim(), customer: tx.json(d.customer), data: tx.json(d as never), totals: tx.json(totals),
      currency: d.currency || "INR", fx: c.exp ? c.fx : 1, taxable: c.taxable, tax: c.tax, grand: c.grand, paid: 0,
      b2b: !!d.customer.gstin, pos_code: c.pos, channel: d.channel || "", order_id: d.orderId || "",
      external_id: opts.externalId || null, ref_invoice_id: ref?.id || null, created_by: opts.actor,
    } as never)} returning *`;
    if (docType === "invoice" && d.status === "paid") {
      const amount = r2(c.grand - c.advance);
      if (amount > 0) await tx`insert into payments (invoice_id, date, amount, mode, ref, created_by) values (${row.id}, ${d.date}, ${amount}, ${d.paymentMode || ""}, ${d.paymentRef || ""}, ${opts.actor})`;
    }
    await refreshStatus(tx, row.id);
    if (ref) await refreshStatus(tx, ref.id);
    await audit(tx, opts.biz, row.id, opts.actor, docType === "credit_note" ? "credit_note.create" : "invoice.create", { number, grand: c.grand, origin, against: ref?.number });
    const [fresh] = await tx<InvoiceRow[]>`select * from invoices where id = ${row.id}`;
    return { row: fresh, existing: false };
  });
}

export async function updateDoc(biz: string, id: string, draft: Draft, actor: string) {
  const brand = mustBrand(biz); const settings = await getSettings(biz);
  return db().begin(async (tx) => {
    const [cur] = await tx<InvoiceRow[]>`select * from invoices where id = ${id} and biz = ${biz} for update`;
    if (!cur) fail("Invoice not found.");
    if (cur!.status === "cancelled") fail("Cancelled documents can't be edited.");
    const keep = { ...draft, series: cur!.series, status: cur!.data.status };
    const { d, c, totals } = prepare(brand, settings, keep);
    if (fyOf(d.date) !== cur!.fy) fail(`The date must stay in FY 20${cur!.fy.slice(0, 2)}-${cur!.fy.slice(2)}, because the number ${cur!.number} belongs to that year.`);
    if (cur!.doc_type === "credit_note" && cur!.ref_invoice_id) {
      const [ref] = await tx<InvoiceRow[]>`select * from invoices where id = ${cur!.ref_invoice_id}`;
      const [cr] = await tx<{ s: number }[]>`select coalesce(sum(grand),0) as s from invoices where ref_invoice_id = ${ref.id} and status <> 'cancelled' and id <> ${id}`;
      if (c.grand > r2(ref.grand - Number(cr.s)) + 0.001) fail("This credit note would credit more than the invoice total.");
    }
    await tx`update invoices set date = ${d.date}, customer_name = ${d.customer.name.trim()}, customer = ${tx.json(d.customer)}, data = ${tx.json(d as never)},
      totals = ${tx.json(totals)}, currency = ${d.currency || "INR"}, fx = ${c.exp ? c.fx : 1}, taxable = ${c.taxable}, tax = ${c.tax}, grand = ${c.grand},
      b2b = ${!!d.customer.gstin}, pos_code = ${c.pos}, channel = ${d.channel || ""}, order_id = ${d.orderId || ""}, updated_at = now() where id = ${id}`;
    await refreshStatus(tx, id);
    if (cur!.ref_invoice_id) await refreshStatus(tx, cur!.ref_invoice_id);
    await audit(tx, biz, id, actor, "invoice.edit", { before: { grand: cur!.grand, customer: cur!.customer_name, date: String(cur!.date).slice(0, 10) }, after: { grand: c.grand, customer: d.customer.name, date: d.date } });
    return id;
  });
}

async function refreshStatus(tx: Tx, id: string) {
  const [r] = await tx<{ status: Status; doc_type: DocType; grand: number; advance: number; paid: number; credited: number }[]>`
    select i.status, i.doc_type, i.grand, coalesce((i.totals->>'advance')::numeric, 0)::float8 as advance,
      coalesce((select sum(amount) from payments p where p.invoice_id = i.id), 0)::float8 as paid,
      coalesce((select sum(grand) from invoices c where c.ref_invoice_id = i.id and c.status <> 'cancelled'), 0)::float8 as credited
    from invoices i where i.id = ${id}`;
  if (!r || r.status === "cancelled") return;
  let status: Status = "issued";
  if (r.doc_type === "invoice") {
    const balance = r2(r.grand - r.advance - r.paid - r.credited);
    status = balance <= 0.004 ? "paid" : r.paid > 0 || r.advance > 0 || r.credited > 0 ? "partial" : "issued";
  }
  await tx`update invoices set status = ${status}, paid = ${r.paid} where id = ${id}`;
}

/* ---------- actions ---------- */
export async function cancelDoc(biz: string, id: string, reason: string, actor: string) {
  await db().begin(async (tx) => {
    const [cur] = await tx<InvoiceRow[]>`select * from invoices where id = ${id} and biz = ${biz} for update`;
    if (!cur) fail("Not found.");
    if (cur!.status === "cancelled") return;
    if (cur!.doc_type === "invoice") {
      const [p] = await tx<{ n: number }[]>`select count(*)::int as n from payments where invoice_id = ${id}`;
      const [k] = await tx<{ n: number }[]>`select count(*)::int as n from invoices where ref_invoice_id = ${id} and status <> 'cancelled'`;
      if (p.n) fail("This invoice has payments recorded. Remove them first, or issue a credit note instead of cancelling.");
      if (k.n) fail("This invoice has credit notes against it. Cancel those first.");
    }
    await tx`update invoices set status = 'cancelled', cancel_reason = ${reason || "Cancelled"}, share_token = null, updated_at = now() where id = ${id}`;
    if (cur!.ref_invoice_id) await refreshStatus(tx, cur!.ref_invoice_id);
    await audit(tx, biz, id, actor, "invoice.cancel", { reason });
  });
}
export async function addPayment(biz: string, id: string, p: { date: string; amount: number; mode: string; ref: string; note: string }, actor: string) {
  await db().begin(async (tx) => {
    const [cur] = await tx<InvoiceRow[]>`select * from invoices where id = ${id} and biz = ${biz} for update`;
    if (!cur || cur.doc_type !== "invoice") fail("Payments can only be recorded on invoices.");
    if (cur!.status === "cancelled") fail("This invoice is cancelled.");
    const amount = r2(p.amount);
    if (!(amount > 0)) fail("Enter an amount more than zero.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date || "")) fail("Enter the payment date.");
    await tx`insert into payments (invoice_id, date, amount, mode, ref, note, created_by) values (${id}, ${p.date}, ${amount}, ${p.mode || ""}, ${p.ref || ""}, ${p.note || ""}, ${actor})`;
    await refreshStatus(tx, id);
    await audit(tx, biz, id, actor, "payment.add", { amount, mode: p.mode, ref: p.ref });
  });
}
export async function deletePayment(biz: string, paymentId: number, actor: string) {
  await db().begin(async (tx) => {
    const [p] = await tx<{ invoice_id: string; amount: number }[]>`select p.invoice_id, p.amount from payments p join invoices i on i.id = p.invoice_id where p.id = ${paymentId} and i.biz = ${biz}`;
    if (!p) fail("Payment not found.");
    await tx`delete from payments where id = ${paymentId}`;
    await refreshStatus(tx, p!.invoice_id);
    await audit(tx, biz, p!.invoice_id, actor, "payment.remove", { amount: p!.amount });
  });
}
export async function setShare(biz: string, id: string, on: boolean, actor: string) {
  const token = on ? crypto.randomBytes(18).toString("base64url") : null;
  const [r] = await db()<{ share_token: string | null }[]>`update invoices set share_token = ${token} where id = ${id} and biz = ${biz} and status <> 'cancelled' returning share_token`;
  if (!r) fail("Can't share a cancelled document.");
  await audit(db(), biz, id, actor, on ? "share.on" : "share.off", {});
  return r!.share_token;
}

/* ---------- reads ---------- */
export async function getDoc(biz: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db()<InvoiceRow[]>`select * from invoices where id = ${id} and biz = ${biz}`;
  if (!row) return null;
  return withRelations(row);
}
export async function bizOfDoc(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [r] = await db()<{ biz: string }[]>`select biz from invoices where id = ${id}`;
  return r?.biz || null;
}
export async function getByToken(token: string) {
  if (!token || token.length < 20) return null;
  const [row] = await db()<InvoiceRow[]>`select * from invoices where share_token = ${token} and status <> 'cancelled'`;
  return row ? withRelations(row) : null;
}
async function withRelations(row: InvoiceRow) {
  const sql = db();
  const payments = await sql<Payment[]>`select id, to_char(date,'YYYY-MM-DD') as date, amount, mode, ref, note, created_by, created_at from payments where invoice_id = ${row.id} order by date, id`;
  const credits = await sql<InvoiceRow[]>`select id, number, to_char(date,'YYYY-MM-DD') as date, grand, status from invoices where ref_invoice_id = ${row.id} order by created_at`;
  const [ref] = row.ref_invoice_id ? await sql<InvoiceRow[]>`select id, number, to_char(date,'YYYY-MM-DD') as date, grand from invoices where id = ${row.ref_invoice_id}` : [];
  const history = await sql<{ actor: string; action: string; detail: Record<string, unknown>; at: string }[]>`select actor, action, detail, at from audit_log where invoice_id = ${row.id} order by at desc limit 50`;
  const credited = r2(credits.filter((c) => c.status !== "cancelled").reduce((a, c) => a + Number(c.grand), 0));
  const date = String(row.date).slice(0, 10);
  return { row: { ...row, date, credited }, payments, credits, ref: ref ? { ...ref, date: String(ref.date).slice(0, 10) } : null, history };
}
export async function qrFor(row: InvoiceRow, settings: Settings) {
  const balance = r2(Number(row.grand) - Number(row.totals?.advance || 0) - Number(row.paid) - Number(row.credited || 0));
  if (row.doc_type !== "invoice" || row.currency !== "INR" || row.status === "paid" || row.status === "cancelled") return null;
  const uri = upiUri(settings, balance, row.number);
  return uri ? QRCode.toDataURL(uri, { margin: 0, width: 184, errorCorrectionLevel: "M" }) : null;
}

export type Filters = { q?: string; fy?: string; status?: string; series?: string; type?: string; channel?: string; from?: string; to?: string };
function where(sql: postgres.Sql, biz: string, f: Filters) {
  const q = (f.q || "").trim();
  return sql`biz = ${biz}
    ${f.fy ? sql`and fy = ${f.fy}` : sql``}
    ${f.status ? sql`and status = ${f.status}` : sql``}
    ${f.series ? sql`and series = ${f.series}` : sql``}
    ${f.type ? sql`and doc_type = ${f.type}` : sql``}
    ${f.channel ? sql`and channel = ${f.channel}` : sql``}
    ${f.from ? sql`and date >= ${f.from}` : sql``}
    ${f.to ? sql`and date <= ${f.to}` : sql``}
    ${q ? sql`and (number ilike ${"%" + q + "%"} or customer_name ilike ${"%" + q + "%"} or order_id ilike ${"%" + q + "%"}
      or customer->>'phone' ilike ${"%" + q + "%"} or customer->>'gstin' ilike ${"%" + q + "%"} or data->>'project' ilike ${"%" + q + "%"})` : sql``}`;
}
export async function listDocs(biz: string, f: Filters, limit = 300) {
  const sql = db();
  return sql<InvoiceRow[]>`select id, number, doc_type, series, origin, to_char(date,'YYYY-MM-DD') as date, status, customer_name, b2b, channel, order_id,
    currency, grand, paid, totals, data->>'project' as project, data->'items'->0->>'desc' as first_item, fy, pos_code, customer, taxable, tax, fx, cancel_reason
    from invoices where ${where(sql, biz, f)} order by date desc, created_at desc limit ${limit}`;
}
export async function listFull(biz: string, f: Filters) {
  const sql = db();
  return sql<InvoiceRow[]>`select * from invoices where ${where(sql, biz, f)} order by date, created_at`;
}
export async function stats(biz: string, f: Filters) {
  const sql = db();
  const [s] = await sql<{ n: number; cn: number; cancelled: number; taxable: number; tax: number; cgst: number; sgst: number; igst: number; outstanding: number; unpaid: number }[]>`
    select
      count(*) filter (where doc_type = 'invoice' and status <> 'cancelled')::int as n,
      count(*) filter (where doc_type = 'credit_note' and status <> 'cancelled')::int as cn,
      count(*) filter (where status = 'cancelled')::int as cancelled,
      coalesce(sum(taxable * fx * case when doc_type = 'credit_note' then -1 else 1 end) filter (where status <> 'cancelled'), 0)::float8 as taxable,
      coalesce(sum(tax * fx * case when doc_type = 'credit_note' then -1 else 1 end) filter (where status <> 'cancelled'), 0)::float8 as tax,
      coalesce(sum((totals->>'cgst')::numeric * case when doc_type = 'credit_note' then -1 else 1 end) filter (where status <> 'cancelled'), 0)::float8 as cgst,
      coalesce(sum((totals->>'sgst')::numeric * case when doc_type = 'credit_note' then -1 else 1 end) filter (where status <> 'cancelled'), 0)::float8 as sgst,
      coalesce(sum((totals->>'igst')::numeric * fx * case when doc_type = 'credit_note' then -1 else 1 end) filter (where status <> 'cancelled'), 0)::float8 as igst,
      coalesce(sum((grand - coalesce((totals->>'advance')::numeric,0) - paid
        - coalesce((select sum(c.grand) from invoices c where c.ref_invoice_id = invoices.id and c.status <> 'cancelled'),0)) * fx)
        filter (where doc_type = 'invoice' and status in ('issued','partial')), 0)::float8 as outstanding,
      count(*) filter (where doc_type = 'invoice' and status in ('issued','partial'))::int as unpaid
    from invoices where ${where(sql, biz, f)}`;
  return s;
}
export async function channels(biz: string) {
  const rows = await db()<{ channel: string }[]>`select distinct channel from invoices where biz = ${biz} and channel <> '' order by channel`;
  return rows.map((r) => r.channel);
}
export async function fys(biz: string) {
  const rows = await db()<{ fy: string }[]>`select distinct fy from invoices where biz = ${biz} order by fy desc`;
  return rows.map((r) => r.fy);
}

/* ---------- audit & API keys ---------- */
export async function audit(tx: Tx, biz: string, invoiceId: string | null, actor: string, action: string, detail: Record<string, unknown>) {
  await tx`insert into audit_log (biz, invoice_id, actor, action, detail) values (${biz}, ${invoiceId}, ${actor}, ${action}, ${tx.json(detail as never)})`;
}
const hashKey = (k: string) => crypto.createHash("sha256").update(k).digest("hex");
export async function createApiKey(biz: string, name: string, actor: string) {
  mustBrand(biz);
  const raw = `ih_${biz}_${crypto.randomBytes(24).toString("base64url")}`;
  await db()`insert into api_keys (biz, name, prefix, key_hash) values (${biz}, ${name || "Website"}, ${raw.slice(0, 16)}, ${hashKey(raw)})`;
  await audit(db(), biz, null, actor, "apikey.create", { name });
  return raw;
}
export async function listApiKeys(biz: string) {
  return db()<{ id: number; name: string; prefix: string; created_at: string; revoked_at: string | null }[]>`select id, name, prefix, created_at, revoked_at from api_keys where biz = ${biz} order by created_at desc`;
}
export async function revokeApiKey(biz: string, id: number, actor: string) {
  await db()`update api_keys set revoked_at = now() where id = ${id} and biz = ${biz}`;
  await audit(db(), biz, null, actor, "apikey.revoke", { id });
}
export async function bizForKey(raw: string) {
  if (!raw?.startsWith("ih_")) return null;
  const [r] = await db()<{ biz: string; name: string }[]>`select biz, name from api_keys where key_hash = ${hashKey(raw)} and revoked_at is null`;
  return r || null;
}

export function draftFromRow(row: InvoiceRow): Draft {
  return { ...(row.data as Draft), date: String(row.date).slice(0, 10) };
}
export const today = todayISO;
