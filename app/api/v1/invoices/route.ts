// Website / checkout integration. Your stores call this to issue an invoice with a W-series number.
//
// POST /api/v1/invoices   Authorization: Bearer ih_<biz>_...
// {
//   "externalId": "order_10023",          // required; the same id never creates a second invoice
//   "series": "VYR",                      // optional; defaults to the business's first series
//   "date": "2026-10-15",                 // optional; defaults to today
//   "status": "paid",                     // "paid" (default) or "issued"
//   "priceMode": "inclusive",             // optional; defaults to the series setting
//   "channel": "Website", "orderId": "10023", "paymentMode": "Razorpay (online)", "paymentRef": "pay_ABC",
//   "customer": { "name": "...", "phone": "...", "email": "...", "gstin": "", "address": "...", "stateCode": "07" },
//   "shipTo": { "name": "...", "address": "...", "stateCode": "07" },     // optional
//   "shipping": 99,
//   "items": [{ "desc": "Shubh Owl Candle", "note": "Ruby", "hsn": "3406", "qty": 2, "rate": 249, "gst": 5 }]
// }
// -> 201 { id, number, total, shareUrl }   (200 with the same body if externalId already exists)
//
// GET /api/v1/invoices?externalId=order_10023  -> the invoice for that order
import { NextRequest } from "next/server";
import { brandOf, seriesOf } from "@/lib/brands";
import { UserError, bizForKey, createDoc, setShare } from "@/lib/invoices";
import { db } from "@/lib/db";
import { Draft, blankDraft } from "@/lib/tax";

async function auth(req: NextRequest) {
  const key = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  return bizForKey(key);
}
const json = (body: unknown, status = 200) => Response.json(body, { status });
const origin = (req: NextRequest) => process.env.APP_URL || req.nextUrl.origin;

export async function POST(req: NextRequest) {
  const k = await auth(req);
  if (!k) return json({ error: "Invalid or revoked API key." }, 401);
  const brand = brandOf(k.biz)!;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Body must be JSON." }, 400); }
  const externalId = String(body.externalId || "").trim();
  if (!externalId) return json({ error: "externalId is required so retries never create duplicates." }, 400);

  const s = seriesOf(brand, String(body.series || brand.series[0].code));
  const base = blankDraft(brand, s.code);
  const items = Array.isArray(body.items) ? body.items : [];
  const draft: Draft = {
    ...base,
    date: typeof body.date === "string" ? body.date : base.date,
    status: body.status === "issued" ? "issued" : "paid",
    priceMode: body.priceMode === "exclusive" || body.priceMode === "inclusive" ? body.priceMode : base.priceMode,
    channel: String(body.channel ?? base.channel), orderId: String(body.orderId ?? ""),
    paymentMode: String(body.paymentMode ?? base.paymentMode), paymentRef: String(body.paymentRef ?? ""),
    shipping: Number(body.shipping) || "", notes: String(body.notes ?? ""),
    customer: { ...base.customer, ...((body.customer as object) || {}) },
    shipSame: !body.shipTo, shipTo: { ...base.shipTo, ...((body.shipTo as object) || {}) },
    items: items.map((x: Record<string, unknown>) => ({
      desc: String(x.desc || ""), note: String(x.note || ""), preset: "", hsn: String(x.hsn || ""), qty: Number(x.qty) || 1, unit: String(x.unit || "Pcs"),
      rate: Number(x.rate) || 0, disc: Number(x.disc) || 0, gst: Number(x.gst ?? 18), apparel: !!x.apparel,
    })),
  };
  try {
    const r = await createDoc({ biz: k.biz, draft, actor: `api:${k.name}`, origin: "W", externalId });
    const token = r.row.share_token || (await setShare(k.biz, r.row.id, true, `api:${k.name}`));
    return json({ id: r.row.id, number: r.row.number, total: Number(r.row.grand), status: r.row.status, shareUrl: `${origin(req)}/i/${token}` }, r.existing ? 200 : 201);
  } catch (e) {
    if (e instanceof UserError) return json({ error: e.message }, 422);
    console.error(e);
    return json({ error: "Could not create the invoice." }, 500);
  }
}

export async function GET(req: NextRequest) {
  const k = await auth(req);
  if (!k) return json({ error: "Invalid or revoked API key." }, 401);
  const externalId = req.nextUrl.searchParams.get("externalId");
  if (!externalId) return json({ error: "Pass ?externalId=" }, 400);
  const [r] = await db()<{ id: string; number: string; grand: number; status: string; share_token: string | null }[]>`
    select id, number, grand, status, share_token from invoices where biz = ${k.biz} and external_id = ${externalId}`;
  if (!r) return json({ error: "Not found." }, 404);
  return json({ id: r.id, number: r.number, total: r.grand, status: r.status, shareUrl: r.share_token ? `${origin(req)}/i/${r.share_token}` : null });
}
