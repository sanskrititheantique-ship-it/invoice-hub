import { notFound, redirect } from "next/navigation";
import { brandOf } from "@/lib/brands";
import { requireAccess } from "@/lib/auth";
import { draftFromRow, getDoc, getSettings, listCatalog, recentCustomers } from "@/lib/invoices";
import InvoiceEditor from "@/components/InvoiceEditor";

export const dynamic = "force-dynamic";

export default async function EditInvoice({ params }: { params: Promise<{ biz: string; id: string }> }) {
  const { biz, id } = await params;
  await requireAccess(biz, "editor");
  const brand = brandOf(biz)!;
  const doc = await getDoc(biz, id);
  if (!doc) notFound();
  if (doc.row.status === "cancelled") redirect(`/b/${biz}/inv/${id}`);
  const [settings, catalog, customers] = await Promise.all([getSettings(biz), listCatalog(biz), recentCustomers(biz)]);
  const credit = doc.row.doc_type === "credit_note" && doc.ref ? { refId: doc.ref.id, refNumber: doc.ref.number, refDate: doc.ref.date, room: Number(doc.ref.grand) } : undefined;
  return (
    <InvoiceEditor brand={brand} settings={settings} catalog={catalog} customers={customers} next={{}}
      mode="edit" id={id} number={doc.row.number} initial={draftFromRow(doc.row)} credit={credit} docType={doc.row.doc_type} />
  );
}
