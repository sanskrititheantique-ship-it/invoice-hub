import { notFound, redirect } from "next/navigation";
import { brandOf } from "@/lib/brands";
import { can, requireUser } from "@/lib/auth";
import { bizOfDoc, draftFromRow, getDoc, getSettings, qrFor } from "@/lib/invoices";
import { sheetHTML } from "@/lib/sheets";
import PrintBar from "@/components/PrintBar";

export const dynamic = "force-dynamic";

export default async function PrintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ auto?: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const biz = await bizOfDoc(id);
  if (!biz) notFound();
  if (!can(user, biz, "viewer")) redirect("/");
  const doc = (await getDoc(biz, id))!;
  const brand = brandOf(biz)!;
  const settings = await getSettings(biz);
  const html = sheetHTML({ brand, settings, d: draftFromRow(doc.row), number: doc.row.number, docType: doc.row.doc_type, ref: doc.ref, status: doc.row.status, paid: Number(doc.row.paid), credited: doc.row.credited, createdAt: String(doc.row.created_at), qr: await qrFor(doc.row, settings) });
  const { auto } = await searchParams;
  return (
    <div className="print-root" data-brand={biz}>
      <title>{doc.row.number.replace(/\//g, "-") + " " + doc.row.customer_name}</title>
      <PrintBar auto={auto === "1"} backHref={`/b/${biz}/inv/${id}`} />
      <div className="sheet-scroll" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
