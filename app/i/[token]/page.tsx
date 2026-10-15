import { notFound } from "next/navigation";
import { brandOf } from "@/lib/brands";
import { draftFromRow, getByToken, getSettings, qrFor } from "@/lib/invoices";
import { sheetHTML, upiUri } from "@/lib/sheets";
import { r2 } from "@/lib/tax";
import PrintBar from "@/components/PrintBar";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

// Public page for customers. Works without signing in, only while the share link is on.
export default async function SharedInvoice({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const doc = await getByToken(token);
  if (!doc) notFound();
  const { row } = doc;
  const brand = brandOf(row.biz)!;
  const settings = await getSettings(row.biz);
  const html = sheetHTML({ brand, settings, d: draftFromRow(row), number: row.number, docType: row.doc_type, ref: doc.ref, status: row.status, paid: Number(row.paid), credited: row.credited, createdAt: String(row.created_at), qr: await qrFor(row, settings) });
  const balance = r2(Number(row.grand) - Number(row.totals?.advance || 0) - Number(row.paid) - Number(row.credited || 0));
  const pay = row.doc_type === "invoice" && row.currency === "INR" && row.status !== "paid" ? upiUri(settings, balance, row.number) : null;
  return (
    <div className="print-root" data-brand={row.biz}>
      <title>{`${row.number} · ${settings.tradeName || brand.name}`}</title>
      <PrintBar payUri={pay} payLabel={`Pay ₹${balance.toFixed(2)} with UPI`} />
      <div className="sheet-scroll" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
