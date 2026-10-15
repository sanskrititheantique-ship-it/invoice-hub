import { brandOf, seriesOf } from "@/lib/brands";
import { requireAccess } from "@/lib/auth";
import { draftFromRow, getDoc, getSettings, listCatalog, peekNext, recentCustomers } from "@/lib/invoices";
import { Draft, blankDraft, creditCode, fyOf, r2, todayISO } from "@/lib/tax";
import InvoiceEditor from "@/components/InvoiceEditor";

export const dynamic = "force-dynamic";

export default async function NewInvoice({ params, searchParams }: { params: Promise<{ biz: string }>; searchParams: Promise<{ series?: string; from?: string; credit?: string }> }) {
  const { biz } = await params;
  await requireAccess(biz, "editor");
  const brand = brandOf(biz)!;
  const sp = await searchParams;
  const [settings, catalog, customers] = await Promise.all([getSettings(biz), listCatalog(biz), recentCustomers(biz)]);
  const fy = fyOf();
  const next: Record<string, string> = {};
  for (const s of brand.series) { next[s.code] = await peekNext(s.code, "G", fy); next[creditCode(s.code)] = await peekNext(creditCode(s.code), "G", fy); }

  let initial: Draft | undefined;
  let credit: { refId: string; refNumber: string; refDate: string; room: number } | undefined;
  if (sp.credit) {
    const ref = await getDoc(biz, sp.credit);
    if (ref && ref.row.doc_type === "invoice" && ref.row.status !== "cancelled") {
      const room = r2(Number(ref.row.grand) - Number(ref.row.credited || 0));
      initial = { ...draftFromRow(ref.row), date: todayISO(), notes: "", reason: "", advance: "", status: "issued" };
      credit = { refId: ref.row.id, refNumber: ref.row.number, refDate: ref.row.date, room };
    }
  } else if (sp.from) {
    const src = await getDoc(biz, sp.from);
    if (src) {
      const s = seriesOf(brand, src.row.series);
      initial = { ...draftFromRow(src.row), date: todayISO(), status: s.defaultStatus, paymentRef: "", orderId: "", reason: "" };
    }
  } else if (sp.series) {
    initial = blankDraft(brand, sp.series);
  }

  return (
    <InvoiceEditor
      key={sp.credit || sp.from || sp.series || "new"}
      brand={brand} settings={settings} catalog={catalog} customers={customers} next={next}
      mode={credit ? "credit" : "new"} initial={initial} credit={credit}
    />
  );
}
