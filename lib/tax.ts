// Pure GST maths, numbering and formatting. Runs in the browser and on the server.
import { Brand, Series, has, seriesOf } from "./brands";

export const STATES: [string, string][] = [["01","Jammu & Kashmir"],["02","Himachal Pradesh"],["03","Punjab"],["04","Chandigarh"],["05","Uttarakhand"],["06","Haryana"],["07","Delhi"],["08","Rajasthan"],["09","Uttar Pradesh"],["10","Bihar"],["11","Sikkim"],["12","Arunachal Pradesh"],["13","Nagaland"],["14","Manipur"],["15","Mizoram"],["16","Tripura"],["17","Meghalaya"],["18","Assam"],["19","West Bengal"],["20","Jharkhand"],["21","Odisha"],["22","Chhattisgarh"],["23","Madhya Pradesh"],["24","Gujarat"],["26","Dadra & Nagar Haveli and Daman & Diu"],["27","Maharashtra"],["29","Karnataka"],["30","Goa"],["31","Lakshadweep"],["32","Kerala"],["33","Tamil Nadu"],["34","Puducherry"],["35","Andaman & Nicobar Islands"],["36","Telangana"],["37","Andhra Pradesh"],["38","Ladakh"],["97","Other Territory"],["96","Outside India"]];
export const STATE_NAME: Record<string, string> = Object.fromEntries(STATES);
export const CURRENCIES: Record<string, [string, string, string]> = {
  INR: ["₹", "Rupees", "Paise"], USD: ["$", "US Dollars", "Cents"], EUR: ["€", "Euros", "Cents"], GBP: ["£", "Pounds Sterling", "Pence"],
  AED: ["AED ", "UAE Dirhams", "Fils"], AUD: ["A$", "Australian Dollars", "Cents"], CAD: ["C$", "Canadian Dollars", "Cents"], SGD: ["S$", "Singapore Dollars", "Cents"],
};
export const GST_RATES = [0, 0.25, 3, 5, 18, 40];

export type Party = { name: string; phone: string; email: string; gstin: string; address: string; stateCode: string };
export type Item = { desc: string; note: string; preset: string; hsn: string; qty: number | string; unit: string; rate: number | string; disc: number | string; gst: number | string; apparel: boolean };
export type Draft = {
  series: string; date: string; priceMode: "inclusive" | "exclusive"; status: "issued" | "paid";
  currency: string; fx: number | string; lut: boolean;
  customer: Party; shipSame: boolean; shipTo: { name: string; address: string; stateCode: string };
  posCode: string; channel: string; orderId: string; paymentMode: string; paymentRef: string;
  shipping: number | string; advance: number | string; dueDate: string;
  project: string; period: string; enrollId: string; batch: string;
  storeName: string; sellerId: string; plan: string; validFrom: string; validTo: string;
  provenance: string; notes: string; reason: string; items: Item[];
};
export type Settings = Record<string, string>;

export const r2 = (n: unknown) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;
export const fmtN = (n: unknown, loc = "en-IN") => (Number(n) || 0).toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const money = (n: unknown, cur = "INR") => (cur === "INR" ? "₹" + fmtN(n) : (CURRENCIES[cur]?.[0] || cur + " ") + fmtN(n, "en-US"));
export const todayISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
export const fmtDate = (s?: string) => { if (!s) return ""; const d = new Date(String(s).slice(0, 10) + "T00:00:00"); return isNaN(+d) ? "" : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); };

/** Indian financial year code: 2026-04-01 .. 2027-03-31 -> "2627" */
export function fyOf(date?: string) {
  const d = new Date((date || todayISO()).slice(0, 10) + "T00:00:00");
  const y = d.getFullYear(), m = d.getMonth() + 1, s = m >= 4 ? y : y - 1;
  return String(s % 100).padStart(2, "0") + String((s + 1) % 100).padStart(2, "0");
}
export const fyLabel = (fy: string) => "20" + fy.slice(0, 2) + "-" + fy.slice(2);
/** GST Rule 46: at most 16 characters, letters/digits/-/ only, unique per FY. VYR/G/2627/0001 = 15. */
export const numFmt = (code: string, origin: string, fy: string, seq: number) => `${code}/${origin}/${fy}/${String(seq).padStart(4, "0")}`;
export const creditCode = (code: string) => code + "C";

export function gstinValid(g: string) {
  g = (g || "").toUpperCase().trim();
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) return false;
  const cp = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let sum = 0;
  for (let i = 0; i < 14; i++) { const v = cp.indexOf(g[i]) * (i % 2 ? 2 : 1); sum += Math.floor(v / 36) + (v % 36); }
  return cp[(36 - (sum % 36)) % 36] === g[14];
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const two = (n: number) => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : ""));
const three = (n: number) => { const h = Math.floor(n / 100), r = n % 100; return (h ? ONES[h] + " Hundred" + (r ? " " : "") : "") + (r ? two(r) : ""); };
function wordsIN(n: number): string { if (!n) return "Zero"; const o: string[] = []; const cr = Math.floor(n / 1e7); n %= 1e7; const l = Math.floor(n / 1e5); n %= 1e5; const t = Math.floor(n / 1e3); n %= 1e3; if (cr) o.push(wordsIN(cr) + " Crore"); if (l) o.push(two(l) + " Lakh"); if (t) o.push(two(t) + " Thousand"); if (n) o.push(three(n)); return o.join(" "); }
function wordsW(n: number) { if (!n) return "Zero"; const o: string[] = []; ([[1e9, "Billion"], [1e6, "Million"], [1e3, "Thousand"]] as [number, string][]).forEach(([v, w]) => { if (n >= v) { o.push(three(Math.floor(n / v)) + " " + w); n %= v; } }); if (n) o.push(three(n)); return o.join(" "); }
export function amountWords(a: number, cur = "INR") {
  a = Math.abs(r2(a)); const i = Math.floor(a + 1e-9), f = Math.round((a - i) * 100);
  const c = CURRENCIES[cur] || CURRENCIES.INR; const w = cur === "INR" ? wordsIN(i) : wordsW(i);
  return `${c[1]} ${w}${f ? " and " + two(f) + " " + c[2] : ""} Only`;
}

export function blankItem(s: Series): Item {
  const p = s.presets[0];
  return { desc: "", note: "", preset: p?.id || "", hsn: p?.hsn || "", qty: 1, unit: p?.unit || "Nos", rate: "", disc: "", gst: p?.gst ?? 18, apparel: !!p?.apparel };
}
export function blankDraft(brand: Brand, code?: string): Draft {
  const s = seriesOf(brand, code || brand.series[0].code);
  return {
    series: s.code, date: todayISO(), priceMode: s.priceMode, status: s.defaultStatus, currency: "INR", fx: "", lut: true,
    customer: { name: "", phone: "", email: "", gstin: "", address: "", stateCode: "" },
    shipSame: true, shipTo: { name: "", address: "", stateCode: "" }, posCode: "",
    channel: s.channels?.[0] || "", orderId: "", paymentMode: s.paymentModes[0], paymentRef: "",
    shipping: "", advance: "", dueDate: "", project: "", period: "", enrollId: "", batch: "",
    storeName: "", sellerId: "", plan: "", validFrom: "", validTo: "", provenance: "", notes: "", reason: "",
    items: [blankItem(s)],
  };
}

/** Garments: 5% when the sale value per piece (before GST) is ₹2,500 or less, otherwise 18%. */
export function effRate(it: Item, mode: string) {
  if (it.apparel) {
    const q = Number(it.qty) || 1; const unit = (Number(it.rate) || 0) - (Number(it.disc) || 0) / q;
    const base = mode === "inclusive" ? unit / 1.05 : unit;
    return base <= 2500 ? 5 : 18;
  }
  return Number(it.gst) || 0;
}

export function posOf(d: Draft, brand: Brand, supplierState: string) {
  if (d.posCode) return d.posCode;
  const s = seriesOf(brand, d.series);
  if (d.currency && d.currency !== "INR") return "96";
  if (has(s, "shipTo") && !d.shipSame && d.shipTo?.stateCode) return d.shipTo.stateCode;
  const g = (d.customer?.gstin || "").trim();
  if (/^\d\d/.test(g) && STATE_NAME[g.slice(0, 2)]) return g.slice(0, 2);
  return d.customer?.stateCode || supplierState;
}

export type Row = Item & { qty: number; rate: number; disc: number; gross: number; r: number; taxable: number; tax: number; amount: number; ship?: boolean };
export type Calc = {
  rows: Row[]; taxable: number; tax: number; igst: number; cgst: number; sgst: number; total: number; grand: number; roundOff: number;
  advance: number; due: number; inter: boolean; zero: boolean; exp: boolean; pos: string; cur: string; fx: number; inr: number | null;
  summary: { hsn: string; r: number; taxable: number; tax: number }[];
};

export function calc(d: Draft, brand: Brand, supplierState: string): Calc {
  const mode = d.priceMode; const cur = d.currency || "INR"; const exp = cur !== "INR"; const zero = exp && d.lut !== false;
  const rows: Row[] = (d.items || []).filter((it) => (it.desc || "").trim() || Number(it.rate)).map((it) => {
    const qty = Number(it.qty) || 0, rate = Number(it.rate) || 0, disc = Number(it.disc) || 0;
    const gross = r2(qty * rate - disc); const r = zero ? 0 : effRate(it, mode);
    const taxable = mode === "inclusive" ? r2(gross / (1 + r / 100)) : gross;
    const tax = mode === "inclusive" ? r2(gross - taxable) : r2((taxable * r) / 100);
    return { ...it, qty, rate, disc, gross, r, taxable, tax, amount: r2(taxable + tax) };
  });
  const ship = Number(d.shipping) || 0;
  if (ship > 0) {
    // Shipping billed with goods is part of a composite supply: it takes the main item's rate.
    const top = rows.reduce<Row | null>((a, x) => (x.r > (a?.r ?? -1) ? x : a), null);
    const r = zero ? 0 : top ? top.r : 0;
    const taxable = mode === "inclusive" ? r2(ship / (1 + r / 100)) : ship;
    const tax = mode === "inclusive" ? r2(ship - taxable) : r2((taxable * r) / 100);
    rows.push({ desc: "Shipping & handling", note: "Charged with the goods (composite supply)", preset: "", hsn: top?.hsn || "", qty: 1, unit: "", rate: ship, disc: 0, gst: r, apparel: false, gross: ship, r, taxable, tax, amount: r2(taxable + tax), ship: true });
  }
  const taxable = r2(rows.reduce((a, x) => a + x.taxable, 0));
  const tax = r2(rows.reduce((a, x) => a + x.tax, 0));
  const pos = posOf(d, brand, supplierState);
  const inter = exp || pos !== supplierState;
  const igst = inter ? tax : 0; const cgst = inter ? 0 : r2(tax / 2); const sgst = inter ? 0 : r2(tax - cgst);
  const total = r2(taxable + tax); const grand = cur === "INR" ? Math.round(total) : total; const roundOff = r2(grand - total);
  const advance = Number(d.advance) || 0; const due = r2(grand - advance);
  const groups: Record<string, { hsn: string; r: number; taxable: number; tax: number }> = {};
  rows.forEach((x) => { const k = (x.hsn || "—") + "|" + x.r; groups[k] ||= { hsn: x.hsn || "—", r: x.r, taxable: 0, tax: 0 }; groups[k].taxable = r2(groups[k].taxable + x.taxable); groups[k].tax = r2(groups[k].tax + x.tax); });
  const fx = Number(d.fx) || 0;
  return { rows, taxable, tax, igst, cgst, sgst, total, grand, roundOff, advance, due, inter, zero, exp, pos, cur, fx, inr: exp && fx ? r2(grand * fx) : null, summary: Object.values(groups) };
}

/** Same rules on the browser and the server. Returns an error message or null. */
export function validate(d: Draft, c: Calc): string | null {
  if (!c.rows.length) return "Add at least one item with a description and price.";
  if (!(d.customer?.name || "").trim()) return "Enter the customer's name.";
  if (d.customer.gstin && !gstinValid(d.customer.gstin)) return "The customer GSTIN fails the checksum. Fix it or clear it.";
  if (c.rows.some((r) => r.qty <= 0)) return "Quantities must be more than zero.";
  if (c.grand <= 0) return "The total must be more than zero.";
  if (c.advance > c.grand) return "The advance can't be more than the total.";
  if (c.exp && !c.fx) return "Enter the exchange rate so the INR value is recorded.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date || "")) return "Enter a valid invoice date.";
  return null;
}
