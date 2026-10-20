import { notFound } from "next/navigation";
import { brandOf, seriesOf } from "@/lib/brands";
import { can, requireAccess } from "@/lib/auth";
import { deleteCheck, draftFromRow, getDoc, getSettings, qrFor } from "@/lib/invoices";
import { sheetHTML } from "@/lib/sheets";
import { r2 } from "@/lib/tax";
import { appUrl } from "@/lib/url";
import SheetPreview from "@/components/SheetPreview";
import InvoiceActions from "@/components/InvoiceActions";

export const dynamic = "force-dynamic";

const ACTIONS: Record<string, string> = {
  "invoice.create": "Issued", "credit_note.create": "Credit note issued", "invoice.edit": "Edited", "invoice.cancel": "Cancelled",
  "payment.add": "Payment recorded", "payment.remove": "Payment removed", "payment.clear": "Marked unpaid", "share.on": "Share link created", "share.off": "Share link turned off",
};

export default async function InvoicePage({ params, searchParams }: { params: Promise<{ biz: string; id: string }>; searchParams: Promise<{ new?: string }> }) {
  const { biz, id } = await params;
  const user = await requireAccess(biz);
  const brand = brandOf(biz)!;
  const doc = await getDoc(biz, id);
  if (!doc) notFound();
  const { row, payments, credits, ref, history } = doc;
  const settings = await getSettings(biz);
  const qr = await qrFor(row, settings);
  const del = await deleteCheck(row);
  const d = draftFromRow(row);
  const html = sheetHTML({ brand, settings, d, number: row.number, docType: row.doc_type, ref, status: row.status, paid: Number(row.paid), credited: row.credited, createdAt: String(row.created_at), qr });
  const balance = r2(Number(row.grand) - Number(row.totals?.advance || 0) - Number(row.paid) - Number(row.credited || 0));
  const { new: isNew } = await searchParams;

  return (
    <div className="view">
      <div className="stack">
        {isNew && <p className="notice ok">Saved as {row.number}.</p>}
        {row.status === "cancelled" && <p className="notice bad">Cancelled{row.cancel_reason ? `: ${row.cancel_reason}` : ""}. The number stays reserved.</p>}
        <SheetPreview html={html} label={<><span>{row.number}{row.origin === "W" ? " · from website" : ""}</span><span>Created by {row.created_by}</span></>} />
        <section className="card">
          <h3>History</h3>
          <ul className="history">
            {history.map((h, i) => (
              <li key={i}>{new Date(h.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })} · {ACTIONS[h.action] || h.action} by {h.actor}
                {h.action === "invoice.edit" && (h.detail as { before?: { grand: number }; after?: { grand: number } }).before?.grand !== (h.detail as { after?: { grand: number } }).after?.grand ? ` (total ${(h.detail as { before: { grand: number } }).before.grand} → ${(h.detail as { after: { grand: number } }).after.grand})` : ""}
                {h.action === "payment.add" ? ` (${(h.detail as { amount: number }).amount})` : ""}
              </li>
            ))}
          </ul>
        </section>
      </div>
      <InvoiceActions
        biz={biz} id={row.id} number={row.number} docType={row.doc_type} status={row.status} currency={row.currency}
        balance={balance} grand={Number(row.grand)} customerName={row.customer_name} customerPhone={d.customer?.phone || ""}
        brandName={settings.tradeName || brand.name} upi={settings.upi || ""} shareToken={row.share_token} appUrl={await appUrl()}
        canEdit={can(user, biz, "editor")} payments={payments.map((x) => ({ ...x, amount: Number(x.amount) }))} paymentModes={seriesOf(brand, row.series).paymentModes}
        credits={credits.map((c) => ({ id: c.id, number: c.number, date: c.date, grand: Number(c.grand), status: c.status }))} against={ref ? { id: ref.id, number: ref.number, date: ref.date } : null}
        canDelete={del.ok} deleteReason={del.reason}
      />
    </div>
  );
}
