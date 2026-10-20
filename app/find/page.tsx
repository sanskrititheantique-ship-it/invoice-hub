import Link from "next/link";
import { redirect } from "next/navigation";
import { BRANDS, brandOf } from "@/lib/brands";
import { can, requireUser } from "@/lib/auth";
import { findByNumber } from "@/lib/invoices";
import { fmtDate, money } from "@/lib/tax";
import FindBox from "@/components/FindBox";

export const dynamic = "force-dynamic";
const STATUS: Record<string, string> = { issued: "Unpaid", partial: "Part paid", paid: "Paid", cancelled: "Cancelled" };

export default async function FindPage({ searchParams }: { searchParams: Promise<{ q?: string; biz?: string }> }) {
  const user = await requireUser();
  const { q = "", biz } = await searchParams;
  const mine = BRANDS.filter((b) => can(user, b.key, "viewer")).map((b) => b.key);
  const scope = biz && mine.includes(biz) ? [biz] : mine;
  let hits = await findByNumber(scope, q, biz);
  // Nothing in this business? Look across the others before giving up.
  if (!hits.length && scope.length < mine.length) hits = await findByNumber(mine, q, biz);
  const exact = hits.filter((h) => h.number === q.trim().toUpperCase());
  if (hits.length === 1 || exact.length === 1) { const h = exact[0] || hits[0]; redirect(`/b/${h.biz}/inv/${h.id}`); }
  const back = biz && brandOf(biz) ? `/b/${biz}` : "/";

  return (
    <main className="wrap" style={{ paddingBlock: 32 }}>
      <div className="stack" style={{ maxWidth: 760 }}>
        <div className="row between"><h2>Find invoice</h2><Link href={back}>Back</Link></div>
        <FindBox biz={biz} />
        {!hits.length ? (
          <p className="notice">No invoice matches “{q}”. Try the full number, like VYR/G/2627/0005, or just the last part, like 5.</p>
        ) : (
          <>
            <p className="muted" style={{ margin: 0 }}>{hits.length} matches for “{q}”. Pick one.</p>
            <div className="tablebox"><table className="reg" style={{ minWidth: 560 }}>
              <thead><tr><th>Number</th><th>Business</th><th>Date</th><th>Customer</th><th style={{ textAlign: "right" }}>Total</th><th>Status</th></tr></thead>
              <tbody>{hits.map((h) => (
                <tr key={h.id}>
                  <td className="n"><Link href={`/b/${h.biz}/inv/${h.id}`}>{h.number}</Link></td>
                  <td>{brandOf(h.biz)?.name}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtDate(h.date)}</td>
                  <td>{h.customer_name}</td>
                  <td className="amt">{money(h.grand, h.currency)}</td>
                  <td><span className={`pill ${h.doc_type === "credit_note" && h.status !== "cancelled" ? "credit" : h.status}`}>{h.doc_type === "credit_note" && h.status !== "cancelled" ? "Credit note" : STATUS[h.status]}</span></td>
                </tr>
              ))}</tbody>
            </table></div>
          </>
        )}
      </div>
    </main>
  );
}
