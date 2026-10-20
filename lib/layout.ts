// What prints on an invoice. Business defaults live in Settings; each invoice can override them.
import type { Brand, SeriesField } from "./brands";

export type SigMode = "digital" | "named" | "line" | "image" | "none";
export type ShowKey =
  | "logoImage" | "tagline" | "headerContact" | "copyLabel" | "timestamp" | "totalBox"
  | "supplierContact" | "customerContact"
  | "order" | "payment" | "project" | "access" | "provenance"
  | "itemNotes" | "discountLine" | "taxTable" | "words"
  | "bank" | "qr"
  | "invoiceNotes" | "terms" | "paidStamp" | "footer";

export type LayoutPatch = { show?: Partial<Record<ShowKey, boolean>>; sig?: SigMode; sigText?: string; thanks?: string };
export type Layout = { show: Record<ShowKey, boolean>; sig: SigMode; sigText: string; thanks: string };
type Template = Brand["template"];

export const DEFAULT_SIG_TEXT = "This is a digitally generated invoice. No signature is required.";
export const DEFAULT_THANKS: Record<Template, string> = {
  vy: "Thank you for choosing Vyrelle. Every piece is crafted to be kept.",
  dt: "",
  lc: "Your business, loud.",
  st: "India's authentic antique marketplace",
};

export const SIG_OPTIONS: { value: SigMode; label: string; hint: string }[] = [
  { value: "digital", label: "Digitally generated, no signature needed", hint: "Prints a note that the invoice is digital, with no name or signature line." },
  { value: "named", label: "Signature line with name", hint: "Uses the authorised signatory name from Business details." },
  { value: "line", label: "Blank signature line", hint: "For signing printed copies by hand." },
  { value: "image", label: "Uploaded signature or stamp", hint: "Upload the image below. Your signatory name prints under it." },
  { value: "none", label: "Nothing", hint: "Leaves the signature area empty." },
];

export type ShowOption = { key: ShowKey; label: string; group: string; only?: Template[]; field?: SeriesField; needsLogo?: boolean };
export const SHOW_OPTIONS: ShowOption[] = [
  { key: "logoImage", label: "Uploaded logo instead of the wordmark", group: "Header", needsLogo: true },
  { key: "tagline", label: "Tagline “Adorn Every Layer”", group: "Header", only: ["vy"] },
  { key: "headerContact", label: "Website & contact in the header", group: "Header", only: ["lc", "st"] },
  { key: "copyLabel", label: "“Original for recipient” label", group: "Header", only: ["vy", "st"] },
  { key: "timestamp", label: "Date & time strip", group: "Header", only: ["dt"] },
  { key: "totalBox", label: "Big amount box", group: "Header", only: ["dt", "lc"] },
  { key: "supplierContact", label: "Your phone & email", group: "Parties" },
  { key: "customerContact", label: "Customer phone & email", group: "Parties" },
  { key: "order", label: "Sold via & order ID", group: "Details", field: "channel" },
  { key: "payment", label: "Payment mode & reference", group: "Details" },
  { key: "project", label: "Project & period line", group: "Details", field: "project" },
  { key: "access", label: "Course access box", group: "Details", field: "enroll" },
  { key: "provenance", label: "Provenance note", group: "Details", field: "provenance" },
  { key: "itemNotes", label: "Item details line", group: "Items & totals" },
  { key: "discountLine", label: "Discount line under items", group: "Items & totals" },
  { key: "taxTable", label: "HSN/SAC tax summary table", group: "Items & totals" },
  { key: "words", label: "Amount in words", group: "Items & totals" },
  { key: "bank", label: "Bank details", group: "Getting paid" },
  { key: "qr", label: "UPI pay QR code (unpaid invoices)", group: "Getting paid" },
  { key: "invoiceNotes", label: "Notes typed on the invoice", group: "Bottom" },
  { key: "terms", label: "Standard terms", group: "Bottom" },
  { key: "paidStamp", label: "PAID stamp", group: "Bottom", only: ["vy", "st"] },
  { key: "footer", label: "Footer (thank-you line & website)", group: "Bottom" },
];
const KEYS = SHOW_OPTIONS.map((o) => o.key);

/** Options that apply to this business (and, if given, to one series). */
export function optionsFor(brand: Brand, seriesFields?: SeriesField[], hasLogo = true) {
  return SHOW_OPTIONS.filter((o) =>
    (!o.only || o.only.includes(brand.template)) &&
    (!o.needsLogo || hasLogo) &&
    (!o.field || (seriesFields ? seriesFields.includes(o.field) : brand.series.some((s) => s.fields.includes(o.field!)))));
}

function parse(json?: string): LayoutPatch {
  if (!json) return {};
  try { return sanitizePatch(JSON.parse(json)); } catch { return {}; }
}

/** Keeps only known keys and safe values. Used on every save. */
export function sanitizePatch(p: unknown): LayoutPatch {
  if (!p || typeof p !== "object") return {};
  const src = p as Record<string, unknown>;
  const out: LayoutPatch = {};
  if (src.show && typeof src.show === "object") {
    const show: Partial<Record<ShowKey, boolean>> = {};
    for (const k of KEYS) { const v = (src.show as Record<string, unknown>)[k]; if (typeof v === "boolean") show[k] = v; }
    if (Object.keys(show).length) out.show = show;
  }
  if (typeof src.sig === "string" && SIG_OPTIONS.some((o) => o.value === src.sig)) out.sig = src.sig as SigMode;
  if (typeof src.sigText === "string") out.sigText = src.sigText.slice(0, 300);
  if (typeof src.thanks === "string") out.thanks = src.thanks.slice(0, 200);
  return out;
}

/** Built-in defaults ← business settings ← this invoice. */
export function resolveLayout(template: Template, settingsLayoutJson?: string, invoice?: LayoutPatch): Layout {
  const biz = parse(settingsLayoutJson);
  const inv = sanitizePatch(invoice);
  const show = Object.fromEntries(KEYS.map((k) => [k, true])) as Record<ShowKey, boolean>;
  Object.assign(show, biz.show, inv.show);
  return {
    show,
    sig: inv.sig || biz.sig || "digital",
    sigText: (inv.sigText ?? biz.sigText ?? "").trim() || DEFAULT_SIG_TEXT,
    thanks: inv.thanks ?? biz.thanks ?? DEFAULT_THANKS[template],
  };
}

export const IMAGE_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
export const validImage = (s?: string) => !!s && s.length < 400_000 && IMAGE_RE.test(s);
