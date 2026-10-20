// Invoice sheet renderers: one HTML design per business. Every value is escaped.
import { Brand, Series, has, seriesOf } from "./brands";
import { Calc, Draft, STATE_NAME, Settings, amountWords, calc, fmtDate, fmtN, fyOf, money, r2 } from "./tax";
import { Layout, resolveLayout, validImage } from "./layout";

export type SheetInput = {
  brand: Brand;
  settings: Settings; // merged business defaults + saved settings
  d: Draft;
  number: string | null;
  docType?: "invoice" | "credit_note";
  ref?: { number: string; date: string } | null;
  status?: "issued" | "partial" | "paid" | "cancelled";
  paid?: number;
  credited?: number;
  createdAt?: string | null;
  qr?: string | null;
};
type V = SheetInput & { s: Series; b: Settings; c: Calc; balance: number; credit: boolean; L: Layout };

const esc = (x: unknown) => String(x ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));
const lines = (s?: string) => esc(s || "").split(/\n/).filter(Boolean).join("<br>");
const stateLine = (code?: string) => (code ? `${esc(STATE_NAME[code] || "")} (${esc(code)})` : "");
const kv = (pairs: [string, string][]) => `<dl class="kv">${pairs.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>`;

function numHTML(v: V) {
  if (v.number) return esc(v.number);
  const code = v.credit ? v.s.code + "C" : v.s.code;
  return `<span class="pending">${esc(code)}/G/${fyOf(v.d.date)}/—— (on save)</span>`;
}
function supplier(v: V, heading: string) {
  const b = v.b;
  return `<div class="party"><div class="lbl">${esc(heading)}</div><b>${esc(b.legalName)}</b>${b.tradeName && b.tradeName !== b.legalName ? `<div>Trading as ${esc(b.tradeName)}</div>` : ""}<div>${lines(b.address)}</div><div>${stateLine(b.stateCode)}</div>${b.gstin ? `<div>GSTIN <strong>${esc(b.gstin)}</strong></div>` : `<div class="pending">GSTIN: add in Settings</div>`}${v.L.show.supplierContact && (b.phone || b.email) ? `<div>${esc([b.phone, b.email].filter(Boolean).join(" · "))}</div>` : ""}</div>`;
}
function buyer(v: V, heading: string) {
  const c = v.d.customer || ({} as Draft["customer"]);
  return `<div class="party"><div class="lbl">${esc(heading)}</div><b>${esc(c.name) || '<span class="pending">Customer name</span>'}</b>${v.d.storeName ? `<div>${esc(v.d.storeName)}</div>` : ""}<div>${lines(c.address)}</div>${c.stateCode ? `<div>${stateLine(c.stateCode)}</div>` : ""}${c.gstin ? `<div>GSTIN ${esc(c.gstin.toUpperCase())}</div>` : ""}${v.L.show.customerContact && (c.phone || c.email) ? `<div>${esc([c.phone, c.email].filter(Boolean).join(" · "))}</div>` : ""}</div>`;
}
function shipTo(v: V) {
  if (!has(v.s, "shipTo") || v.d.shipSame) return "";
  const s = v.d.shipTo;
  return `<div class="party ship"><div class="lbl">Shipped to</div><b>${esc(s.name || v.d.customer.name)}</b><div>${lines(s.address)}</div><div>${stateLine(s.stateCode)}</div></div>`;
}
function meta(v: V): [string, string][] {
  const d = v.d, c = v.c, s = v.s, p: [string, string][] = [];
  p.push([v.credit ? "Credit note no." : "Invoice no.", numHTML(v)]);
  p.push(["Date", esc(fmtDate(d.date))]);
  if (v.credit && v.ref) p.push(["Against invoice", `${esc(v.ref.number)} dated ${esc(fmtDate(v.ref.date))}`]);
  if (has(s, "project") && d.dueDate && !v.credit) p.push(["Due date", esc(fmtDate(d.dueDate))]);
  p.push(["Place of supply", c.exp ? "Outside India (export)" : stateLine(c.pos)]);
  p.push(["Reverse charge", "No"]);
  if (has(s, "channel") && d.channel && v.L.show.order) p.push(["Sold via", esc(d.channel)]);
  if (has(s, "channel") && d.orderId && v.L.show.order) p.push(["Order ID", esc(d.orderId)]);
  if (has(s, "enroll") && d.enrollId) p.push(["Enrollment ID", esc(d.enrollId)]);
  if (d.paymentMode && !v.credit && v.L.show.payment) p.push(["Payment", esc(d.paymentMode) + (d.paymentRef ? " · " + esc(d.paymentRef) : "")]);
  if (c.exp && c.fx) p.push(["Exchange rate", `1 ${esc(c.cur)} = ₹${fmtN(c.fx)}`]);
  return p;
}
function items(v: V) {
  const c = v.c, incl = v.d.priceMode === "inclusive", code = v.s.kind === "goods" ? "HSN" : "SAC";
  if (!c.rows.length) return `<table class="it"><thead><tr><th class="l">Item</th></tr></thead><tbody><tr><td class="l pending">Add an item to see it here</td></tr></tbody></table>`;
  return `<table class="it"><thead><tr><th>#</th><th class="l">${esc(v.s.itemHead)}</th><th>${code}</th><th class="num">Qty</th><th class="num">${incl ? "Price incl. GST" : "Rate"}</th><th class="num">Taxable</th><th class="num">GST</th><th class="num">Amount</th></tr></thead><tbody>${c.rows
    .map((r, i) => `<tr><td>${i + 1}</td><td class="l"><div class="d">${esc(r.desc)}</div>${r.note && (v.L.show.itemNotes || r.ship) ? `<div class="sub">${esc(r.note)}</div>` : ""}${r.disc && v.L.show.discountLine ? `<div class="sub">Less discount ${fmtN(r.disc)}</div>` : ""}${r.apparel ? `<div class="sub">Garment rate by sale value per piece</div>` : ""}</td><td>${esc(r.hsn)}</td><td class="num">${r.ship ? "—" : r.qty + (r.unit ? " " + esc(r.unit) : "")}</td><td class="num">${fmtN(r.rate)}</td><td class="num">${fmtN(r.taxable)}</td><td class="num">${r.r}%</td><td class="num">${fmtN(r.amount)}</td></tr>`)
    .join("")}</tbody></table>`;
}
function taxTable(v: V) {
  const c = v.c;
  if (!c.rows.length) return "";
  if (c.zero) return `<p class="lut">Supply meant for export under Letter of Undertaking without payment of IGST${v.b.lut ? ` (LUT ARN ${esc(v.b.lut)})` : ""}.</p>`;
  if (!v.L.show.taxTable) return "";
  const head = c.inter ? `<th>IGST %</th><th>IGST</th>` : `<th>CGST %</th><th>CGST</th><th>SGST %</th><th>SGST</th>`;
  const rows = c.summary.map((g) => { const cg = r2(g.tax / 2); return `<tr><td>${esc(g.hsn)}</td><td>${fmtN(g.taxable)}</td>${c.inter ? `<td>${g.r}%</td><td>${fmtN(g.tax)}</td>` : `<td>${g.r / 2}%</td><td>${fmtN(cg)}</td><td>${g.r / 2}%</td><td>${fmtN(r2(g.tax - cg))}</td>`}<td>${fmtN(g.tax)}</td></tr>`; }).join("");
  return `<table class="tx"><thead><tr><th>${v.s.kind === "goods" ? "HSN" : "SAC"}</th><th>Taxable</th>${head}<th>Total tax</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function totals(v: V) {
  const c = v.c, m = (n: number) => money(n, c.cur), r: [string, string][] = [];
  r.push(["Taxable value", m(c.taxable)]);
  if (c.zero) r.push(["IGST (0%, under LUT)", m(0)]);
  else if (c.inter) r.push(["IGST", m(c.igst)]);
  else { r.push(["CGST", m(c.cgst)]); r.push(["SGST", m(c.sgst)]); }
  if (c.roundOff) r.push(["Round off", (c.roundOff > 0 ? "+" : "−") + fmtN(Math.abs(c.roundOff))]);
  let h = `<table class="tot">${r.map(([k, x]) => `<tr><td>${k}</td><td class="num">${x}</td></tr>`).join("")}<tr class="grand"><td>${v.credit ? "Credit total" : "Total"}</td><td class="num">${m(c.grand)}</td></tr>`;
  if (!v.credit) {
    if (c.advance) h += `<tr><td>Advance received</td><td class="num">−${m(c.advance)}</td></tr>`;
    if (v.paid) h += `<tr><td>Payments received</td><td class="num">−${m(v.paid)}</td></tr>`;
    if (v.credited) h += `<tr><td>Credit notes</td><td class="num">−${m(v.credited)}</td></tr>`;
    if (c.advance || v.paid || v.credited) h += `<tr class="grand"><td>Balance due</td><td class="num">${m(v.balance)}</td></tr>`;
  }
  if (c.inr) h += `<tr><td>Total in INR</td><td class="num">₹${fmtN(c.inr)}</td></tr>`;
  return h + `</table>` + (v.L.show.words ? `<p class="words">${esc(amountWords(c.grand, c.cur))}</p>` : "");
}
function pay(v: V, force = false) {
  const b = v.b, open = v.status !== "paid" && v.status !== "cancelled" && !v.credit && v.balance > 0;
  const L = v.L.show;
  if ((!force && !open) || v.credit || !(L.bank || L.qr)) return "";
  if (!(L.bank && (b.bankName || b.account || b.upi)) && !(L.qr && open && b.upi)) return "";
  const p: [string, string][] = [];
  if (b.bankName) p.push(["Bank", esc(b.bankName)]);
  if (b.accName) p.push(["Account name", esc(b.accName)]);
  if (b.account) p.push(["Account no.", esc(b.account)]);
  if (b.ifsc) p.push(["IFSC", esc(b.ifsc)]);
  if (b.swift && v.c.exp) p.push(["SWIFT", esc(b.swift)]);
  if (b.upi) p.push(["UPI", esc(b.upi)]);
  const qr = !L.qr || !open ? "" : v.qr ? `<img class="qr" alt="UPI QR code" src="${v.qr}">` : b.upi && v.c.cur === "INR" ? `<div class="qr qr-ph">UPI QR<br>on saved<br>invoice</div>` : "";
  if (!L.bank && !qr) return "";
  return `<div><div class="lbl">${!L.bank ? "Scan to pay" : open ? "Pay to" : "Bank details"}</div><div class="pay">${qr}${L.bank ? kv(p) : ""}</div></div>`;
}
function sig(v: V) {
  const L = v.L, who = `<div>For ${esc(v.b.legalName)}</div>`;
  switch (L.sig) {
    case "none": return `<div></div>`;
    case "digital": return `<div class="sig sig-digital">${who}<p>${esc(L.sigText)}</p></div>`;
    case "line": return `<div class="sig">${who}<div class="line">Authorised signatory</div></div>`;
    case "image":
      if (validImage(v.b.sigImg)) return `<div class="sig has-img">${who}<img class="sig-img" alt="Signature" src="${esc(v.b.sigImg)}"><div class="line">${esc(v.b.signatory || "Authorised signatory")}</div></div>`;
      return `<div class="sig">${who}<div class="line">${esc(v.b.signatory || "Authorised signatory")}</div></div>`;
    default: return `<div class="sig">${who}<div class="line">${esc(v.b.signatory || "Authorised signatory")}</div></div>`;
  }
}
function notes(v: V) {
  const S = v.L.show;
  const t = [v.credit && v.d.reason ? "Reason: " + v.d.reason : "", S.invoiceNotes ? v.d.notes : "", v.credit || !S.terms ? "" : v.b.terms].filter(Boolean);
  return t.length ? `<div><div class="lbl">Notes &amp; terms</div><div class="notes-text">${esc(t.join("\n"))}</div></div>` : "";
}
const stamp = (v: V) => (v.status === "cancelled" ? `<div class="void"><span>CANCELLED</span></div>` : v.status === "paid" && !v.credit && v.L.show.paidStamp ? `<div class="paid-stamp">PAID</div>` : "");
const titleOf = (v: V) => (v.credit ? "Credit note" : "Tax invoice");
// The footer repeats "computer-generated" only when the signature area doesn't already say it.
const foot = (v: V) => (v.L.sig === "digital" ? "" : "This is a computer-generated document.");
const join = (...parts: string[]) => parts.filter(Boolean).join("  ·  ");
const logo = (v: V, fallback: string) => (v.L.show.logoImage && validImage(v.b.logoImg) ? `<img class="brand-logo" alt="${esc(v.b.tradeName || v.brand.name)}" src="${esc(v.b.logoImg)}">` : fallback);

function vy(v: V) {
  const b = v.b, S = v.L.show;
  return `<div class="paper p-vy">${stamp(v)}
<header class="vy-head">${logo(v, `<div class="vy-mark">VYRELLE</div>`)}${S.tagline ? `<div class="vy-tag">Adorn Every Layer</div>` : ""}</header><div class="vy-rule"></div>
<div class="vy-title"><h1>${titleOf(v)}</h1>${S.copyLabel ? `<span class="copy">Original for recipient</span>` : ""}</div>
<div class="cols3">${supplier(v, "Sold by")}${buyer(v, "Billed to")}<div>${kv(meta(v))}</div></div>${shipTo(v)}
${items(v)}
<div class="bottom"><div>${taxTable(v)}</div><div>${totals(v)}</div></div>
<div class="notes-row"><div class="stack">${pay(v)}${notes(v)}</div>${sig(v)}</div>
${S.footer ? `<footer class="vy-foot">${v.L.thanks ? `<em>${esc(v.L.thanks)}</em>` : ""}${esc(join(b.website, b.email, b.phone, foot(v)))}</footer>` : ""}</div>`;
}
function dt(v: V) {
  const b = v.b, d = v.d, c = v.c, S = v.L.show;
  const t = v.createdAt ? new Date(v.createdAt) : new Date();
  const hh = t.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
  const acc: [string, string][] = [];
  if (d.customer?.email) acc.push(["Access email", esc(d.customer.email)]);
  if (d.enrollId) acc.push(["Enrollment ID", esc(d.enrollId)]);
  if (d.batch) acc.push(["Batch / starts", esc(d.batch)]);
  const label = v.credit ? "Credited" : v.status === "paid" ? "Paid" : "Amount due";
  return `<div class="paper p-dt">${stamp(v)}
<div class="dt-bar">${logo(v, `<div class="dt-logo"><span class="dt-dot"></span>DT.live</div>`)}${S.timestamp ? `<div class="dt-strip mono">${esc(fmtDate(d.date))} · ${hh} IST · New Delhi</div>` : ""}</div>
<div class="dt-hero"><div><h1>${titleOf(v)}</h1><div class="no mono">${numHTML(v)}</div></div>${S.totalBox ? `<div class="dt-total"><span>${label}</span><b>${money(v.credit || v.status === "paid" ? c.grand : v.balance, c.cur)}</b></div>` : ""}</div>
<div class="dt-grid">${supplier(v, "From")}${buyer(v, "Learner")}<div>${kv(meta(v))}</div></div>
<div class="dt-body">${items(v)}
${S.access && acc.length && !v.credit ? `<div class="dt-access">${acc.map(([k, x]) => `<div><div class="lbl">${k}</div><div class="mono">${x}</div></div>`).join("")}</div>` : ""}
<div class="bottom"><div>${taxTable(v)}</div><div>${totals(v)}</div></div>
<div class="notes-row"><div class="stack">${pay(v)}${notes(v)}</div>${sig(v)}</div></div>
${S.footer ? `<div class="dt-foot mono"><span>${esc(join(v.L.thanks, b.website, b.email))}</span><span>${foot(v)}</span></div>` : ""}</div>`;
}
function lc(v: V) {
  const b = v.b, d = v.d, c = v.c, S = v.L.show;
  const label = v.credit ? "Credited" : v.status === "paid" ? "Paid in full" : "Amount due";
  const amt = v.credit || v.status === "paid" ? c.grand : v.balance;
  const p = pay(v, true), n = notes(v);
  return `<div class="paper p-lc">${stamp(v)}
<div class="lc-top">${logo(v, `<div class="lc-logo">loudcousin</div>`)}<div class="lc-from">${esc(b.legalName)}${b.tradeName ? ` · ${esc(b.tradeName)}` : ""}<br>${b.gstin ? "GSTIN " + esc(b.gstin) : '<span class="pending">GSTIN: add in Settings</span>'}${S.headerContact ? `<br>${esc([b.website, b.email].filter(Boolean).join(" · "))}` : ""}</div></div>
<div class="lc-title"><h1>${v.credit ? "Credit <mark>note.</mark>" : "Tax <mark>invoice.</mark>"}</h1>${S.totalBox ? `<div class="lc-due"><span>${label}</span><b>${money(amt, c.cur)}</b>${!v.credit && v.status !== "paid" && d.dueDate ? `<small>by ${esc(fmtDate(d.dueDate))}</small>` : ""}</div>` : ""}</div>
<div class="cols3 lc-cols">${buyer(v, "Billed to")}${supplier(v, "From")}<div>${kv(meta(v))}</div></div>
${S.project && (d.project || d.period) ? `<div class="lc-project">${d.project ? `Project: <b>${esc(d.project)}</b>` : ""}${d.project && d.period ? " · " : ""}${d.period ? `Period: <b>${esc(d.period)}</b>` : ""}</div>` : ""}
${items(v)}
<div class="bottom"><div>${taxTable(v)}</div><div>${totals(v)}</div></div>
<div class="notes-row"><div class="stack">${p}${n}</div>${sig(v)}</div>
${S.footer ? `<div class="lc-foot"><b>${esc(v.L.thanks)}</b><span>${foot(v)}</span></div>` : ""}</div>`;
}
function st(v: V) {
  const b = v.b, d = v.d, S = v.L.show;
  const enroll = has(v.s, "seller");
  const extra: [string, string][] = [];
  if (enroll) {
    if (d.sellerId) extra.push(["Seller ID", esc(d.sellerId)]);
    if (d.plan) extra.push(["Plan", esc(d.plan)]);
    if (d.validFrom || d.validTo) extra.push(["Valid", esc(fmtDate(d.validFrom)) + " – " + esc(fmtDate(d.validTo))]);
  }
  const subtitle = v.credit ? "Issued against the invoice below" : enroll ? "Seller enrollment" : S.copyLabel ? "Original for recipient" : "";
  return `<div class="paper p-st">${stamp(v)}<div class="st-frame">
<div class="st-head">${logo(v, `<div class="st-name">Sanskriti</div><div class="st-sub">THE ANTIQUE</div>`)}<div class="st-orn"><i></i><s></s><i></i></div>${S.headerContact ? `<div class="st-line">${esc(join(b.website, b.phone, b.email))}</div>` : ""}</div>
<div class="st-title"><h1>${titleOf(v)}</h1>${subtitle ? `<p>${subtitle}</p>` : ""}</div>
${!enroll && d.channel && S.order ? `<div class="st-badge-row"><span class="st-badge">Sold via ${esc(d.channel)}${d.orderId ? " · " + esc(d.orderId) : ""}</span></div>` : ""}
<div class="cols3 st-cols">${supplier(v, "Issued by")}${buyer(v, enroll ? "Enrolled seller" : "Billed to")}<div>${kv(meta(v).concat(extra))}</div></div>${shipTo(v)}
${items(v)}
${!enroll && d.provenance && S.provenance ? `<div class="st-prov">${esc(d.provenance)}</div>` : ""}
<div class="bottom"><div>${taxTable(v)}</div><div>${totals(v)}</div></div>
<div class="notes-row"><div class="stack">${pay(v, enroll)}${notes(v)}</div>${sig(v)}</div>
${S.footer ? `<div class="st-foot">${v.L.thanks ? `<b>${esc(v.L.thanks)}</b>` : ""}${v.L.thanks && foot(v) ? " · " : ""}${foot(v)}</div>` : ""}</div></div>`;
}
const SHEETS = { vy, dt, lc, st };

export function sheetHTML(input: SheetInput) {
  const b = { ...input.brand.business, ...input.settings } as Settings;
  const c = calc(input.d, input.brand, b.stateCode || input.brand.business.stateCode);
  const paid = input.paid || 0, credited = input.credited || 0;
  const L = resolveLayout(input.brand.template, b.layout, input.d.layout);
  const v: V = { ...input, s: seriesOf(input.brand, input.d.series), b, c, paid, credited, L, balance: r2(c.grand - c.advance - paid - credited), credit: input.docType === "credit_note" };
  return SHEETS[input.brand.template](v);
}

export function upiUri(settings: Settings, amount: number, note: string) {
  if (!settings.upi || !(amount > 0)) return null;
  return `upi://pay?pa=${encodeURIComponent(settings.upi)}&pn=${encodeURIComponent(settings.legalName || "")}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(note)}`;
}
