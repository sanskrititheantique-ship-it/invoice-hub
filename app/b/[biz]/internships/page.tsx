import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requireAccess } from "@/lib/auth";
import { internshipsEnabled, listInternships } from "@/lib/internships";
import { formatDate, formatRef } from "@/lib/internship-fields";

export const dynamic = "force-dynamic";
const STATUS: Record<string, [string, string]> = { draft: ["Draft", "credit"], active: ["Active", "paid"], completed: ["Completed", "issued"], ended: ["Ended early", "cancelled"] };

export default async function Internships({ params }: { params: Promise<{ biz: string }> }) {
  const { biz } = await params;
  if (!internshipsEnabled(biz)) notFound();
  const user = await requireAccess(biz);
  const rows = await listInternships(biz);
  const active = rows.filter((r) => r.status === "active").length;

  return (
    <div className="stack">
      <div className="row between">
        <h2>Internships</h2>
        {can(user, biz, "editor") && <Link className="btn primary" href={`/b/${biz}/internships/new`}>New internship</Link>}
      </div>
      <div className="kpis">
        <div className="kpi"><span>Interns</span><b>{rows.length}</b></div>
        <div className="kpi"><span>Active now</span><b>{active}</b></div>
        <div className="kpi"><span>Documents made</span><b>{rows.reduce((n, r) => n + r.docs, 0)}</b></div>
      </div>
      {!rows.length ? (
        <p className="notice">No internships yet. Click <b>New internship</b> to make an offer letter, agreement and certificate.</p>
      ) : (
        <div className="tablebox">
          <table className="reg">
            <thead><tr><th>Reference</th><th>Intern</th><th>Role</th><th>Start</th><th>Docs</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const href = `/b/${biz}/internships/${r.id}`;
                const [label, cls] = STATUS[r.status] || [r.status, "credit"];
                return (
                  <tr key={r.id}>
                    <td className="n"><Link href={href}>{formatRef(r.refCode)}</Link></td>
                    <td><Link href={href}>{r.internName}</Link></td>
                    <td className="muted">{r.role}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDate(r.startDate, true)}</td>
                    <td className="n">{r.docs}</td>
                    <td><span className={`pill ${cls}`}>{label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
