import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { can, requireUser } from "@/lib/auth";
import { bizOfInternship, getInternship, logDocument } from "@/lib/internships";
import { DOC_FILE, DocKind, docHTML } from "@/lib/internship-sheets";
import { fileName } from "@/lib/internship-fields";
import PrintBar from "@/components/PrintBar";

export const dynamic = "force-dynamic";
const KINDS: DocKind[] = ["offer", "agreement", "both", "certificate"];
const kindOf = (d?: string): DocKind => (KINDS.includes(d as DocKind) ? (d as DocKind) : "offer");

// The browser offers the page title as the PDF's file name, so it has to be
// the document's own name rather than the site's default "Invoice Hub".
export async function generateMetadata({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ doc?: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { doc } = await searchParams;
  try {
    const biz = await bizOfInternship(id);
    const it = biz ? await getInternship(biz, id) : null;
    if (it) return { title: fileName(it.payload.fields.internName, it.refCode, DOC_FILE[kindOf(doc)]) };
  } catch {
    // A title is never worth failing the page over.
  }
  return { title: "Internship document" };
}

export default async function InternshipPrint({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ doc?: string; auto?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const biz = await bizOfInternship(id);
  if (!biz) notFound();
  if (!can(user, biz, "viewer")) redirect("/");
  const it = await getInternship(biz, id);
  if (!it) notFound();
  const kind = kindOf(sp.doc);

  // Recorded on open: the print dialog can't report back whether it was saved.
  await logDocument(biz, it, kind, user.email);

  const html = docHTML(kind, { p: it.payload, refCode: it.refCode });
  const landscape = kind === "certificate";
  return (
    <div className="print-root" data-brand={biz}>
      <style>{`@media print{@page{size:A4 ${landscape ? "landscape" : "portrait"};margin:0}}`}</style>
      <PrintBar auto={sp.auto === "1"} backHref={`/b/${biz}/internships/${id}`} />
      <p className="hint no-print" style={{ margin: 0, textAlign: "center" }}>In the print window choose <b>Save as PDF</b>, and turn off <b>Headers and footers</b>.</p>
      <div className="sheet-scroll"><div className="lcx-stack" dangerouslySetInnerHTML={{ __html: html }} /></div>
    </div>
  );
}
