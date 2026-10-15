import { NextRequest } from "next/server";
import { can, currentUser } from "@/lib/auth";
import { brandOf, seriesOf } from "@/lib/brands";
import { Filters, InvoiceRow, getSettings, listFull } from "@/lib/invoices";
import { STATE_NAME, calc, fyLabel, r2 } from "@/lib/tax";

const cell = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csv = (rows: unknown[][]) => "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");

export async function GET(req: NextRequest, ctx: { params: Promise<{ biz: string }> }) {
  const { biz } = await ctx.params;
  const brand = brandOf(biz);
  const user = await currentUser();
  if (!brand || !can(user, biz, "viewer")) return new Response("Not allowed", { status: 403 });
  const sp = req.nextUrl.searchParams;
  const f: Filters = Object.fromEntries(["q", "fy", "status", "series", "type", "channel", "from", "to"].map((k) => [k, sp.get(k) || ""]));
  const kind = sp.get("kind") || "invoices";
  const rows = await listFull(biz, f);
  const settings = await getSettings(biz);
  const sign = (r: InvoiceRow) => (r.doc_type === "credit_note" ? -1 : 1);
  let body: string;

  if (kind === "hsn") {
    const g: Record<string, { hsn: string; rate: number; qty: number; value: number; taxable: number; igst: number; cgst: number; sgst: number }> = {};
    for (const r of rows.filter((x) => x.status !== "cancelled")) {
      const c = calc(r.data, brand, settings.stateCode);
      const fx = Number(r.fx) || 1, s = sign(r);
      for (const x of c.rows) {
        const k = (x.hsn || "—") + "|" + x.r;
        const o = (g[k] ||= { hsn: x.hsn || "—", rate: x.r, qty: 0, value: 0, taxable: 0, igst: 0, cgst: 0, sgst: 0 });
        o.qty += x.ship ? 0 : s * x.qty;
        o.value = r2(o.value + s * x.amount * fx);
        o.taxable = r2(o.taxable + s * x.taxable * fx);
        if (c.inter) o.igst = r2(o.igst + s * x.tax * fx);
        else { const cg = r2(x.tax / 2); o.cgst = r2(o.cgst + s * cg); o.sgst = r2(o.sgst + s * (x.tax - cg)); }
      }
    }
    body = csv([["HSN/SAC", "Rate %", "Total quantity", "Total value (INR)", "Taxable value (INR)", "IGST", "CGST", "SGST"], ...Object.values(g).map((o) => [o.hsn, o.rate, o.qty, o.value, o.taxable, o.igst, o.cgst, o.sgst])]);
  } else {
    body = csv([
      ["Number", "Type", "Date", "FY", "Series", "Status", "Customer", "Customer GSTIN", "B2B/B2C", "Phone", "Email", "Place of supply", "Channel", "Order ID", "Project", "Currency", "FX", "Taxable", "CGST", "SGST", "IGST", "Round off", "Total", "Advance", "Paid", "Total (INR)", "Cancel reason"],
      ...rows.map((r) => {
        const t = r.totals || {}; const cust = (r.data?.customer || {}) as Record<string, string>;
        return [r.number, r.doc_type === "credit_note" ? "Credit note" : "Invoice", r.date, fyLabel(r.fy), seriesOf(brand, r.series).label, r.status, r.customer_name, cust.gstin || "", r.b2b ? "B2B" : "B2C", cust.phone || "", cust.email || "",
          `${r.pos_code}-${STATE_NAME[r.pos_code] || ""}`, r.channel, r.order_id, r.data?.project || "", r.currency, r.fx, sign(r) * (t.taxable || 0), sign(r) * (t.cgst || 0), sign(r) * (t.sgst || 0), sign(r) * (t.igst || 0), t.roundOff || 0,
          sign(r) * Number(r.grand), t.advance || 0, r.paid, r2(sign(r) * Number(r.grand) * (Number(r.fx) || 1)), r.cancel_reason || ""];
      }),
    ]);
  }
  const name = `${biz}-${kind}${f.fy ? "-FY" + fyLabel(f.fy) : ""}.csv`;
  return new Response(body, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}"` } });
}
