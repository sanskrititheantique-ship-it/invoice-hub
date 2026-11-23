import { notFound } from "next/navigation";
import { can, requireAccess } from "@/lib/auth";
import { getInternship, internshipsEnabled, listDocuments } from "@/lib/internships";
import { DOC_LABEL } from "@/lib/internship-sheets";
import InternshipEditor from "@/components/InternshipEditor";

export const dynamic = "force-dynamic";

export default async function EditInternship({ params }: { params: Promise<{ biz: string; id: string }> }) {
  const { biz, id } = await params;
  if (!internshipsEnabled(biz)) notFound();
  const user = await requireAccess(biz);
  const it = await getInternship(biz, id);
  if (!it) notFound();
  const docs = await listDocuments(biz, id);
  return (
    <>
      <InternshipEditor key={it.updatedAt} biz={biz} id={it.id} refCode={it.refCode} status={it.status} initial={it.payload} canEdit={can(user, biz, "editor")} />
      <section className="card" style={{ marginTop: 24 }}>
        <h3>Documents made</h3>
        {!docs.length ? <p className="hint" style={{ margin: 0 }}>None yet. Each download is recorded here with an exact copy of what it said.</p> : (
          <div className="tablebox">
            <table className="reg">
              <thead><tr><th>When</th><th>Document</th><th>Reference</th><th>By</th></tr></thead>
              <tbody>{docs.map((d) => (
                <tr key={d.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{new Date(d.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</td>
                  <td>{DOC_LABEL[d.kind] || d.kind}</td>
                  <td className="n">{d.refNo}</td>
                  <td className="muted">{d.createdBy}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
