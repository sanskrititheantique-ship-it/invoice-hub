import Link from "next/link";
import { brandOf, has, seriesOf } from "@/lib/brands";
import { can, requireAccess } from "@/lib/auth";
import { Filters, channels, fys, listDocs, stats } from "@/lib/invoices";
import { fmtDate, fmtN, fyLabel, fyOf, money } from "@/lib/tax";

export const dynamic = "force-dynamic";
const STATUS: Record<string, string> = { issued: "Unpaid", partial: "Part paid", paid: "Paid", cancelled: "Cancelled" };

export default async function Register({ params, searchParams }: { params: Promise<{ biz: string }>; searchParams: Promise<Record<string, string>> }) {
  const { biz } = await params;
  const user = await requireAccess(biz);
  const brand = brandOf(biz)!;
  const sp = await searchParams;
  const f: Filters = { q: sp.q || "", fy: sp.fy ?? fyOf(), status: sp.status || "", series: sp.series || "", type: sp.type || "", channel: sp.channel || "", from: sp.from || "", to: sp.to || "" };
  const [rows, s, chans, years] = await Promise.all([listDocs(biz, f), stats(biz, f), channels(biz), fys(biz)]);
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();
  const extraHead = brand.series.some((x) => has(x, "channel")) ? "Channel / order" : brand.series.some((x) => has(x, "project")) ? "Project" : brand.series.some((x) => has(x, "enroll")) ? "Course" : "Type";

  return (
    <div className="stack">
      {sp.deleted && <p className="notice ok" style={{ margin: 0 }}>Deleted {sp.deleted}. The next invoice in that series reuses its number.</p>}
      <div className="row between">
        <h2>Register</h2>
        <div className="row">
          <a className="btn sm" href={`/api/b/${biz}/export?kind=invoices&${qs}`}>Export CSV</a>
          <a className="btn sm" href={`/api/b/${biz}/export?kind=hsn&${qs}`}>HSN/SAC summary</a>
          {can(user, biz, "editor") && <Link className="btn sm primary" href={`/b/${biz}/new`}>New invoice</Link>}
        </div>
      </div>

      <div className="kpis" style={{ marginBlock: 0 }}>
        <div className="kpi"><span>Invoices</span><b>{s.n}</b><small>{s.cn} credit notes · {s.cancelled} cancelled</small></div>
        <div className="kpi"><span>Net taxable value</span><b>₹{fmtN(s.taxable)}</b><small>after credit notes</small></div>
        <div className="kpi"><span>Net GST</span><b>₹{fmtN(s.tax)}</b><small>CGST ₹{fmtN(s.cgst)} · SGST ₹{fmtN(s.sgst)} · IGST ₹{fmtN(s.igst)}</small></div>
        <div className="kpi"><span>Outstanding</span><b>₹{fmtN(s.outstanding)}</b><small>{s.unpaid} invoices not fully paid</small></div>
      </div>

      <form className="filters" method="get">
        <label className="f grow"><span>Search</span><input id="q" name="q" defaultValue={f.q} placeholder="Number, customer, phone, GSTIN, order ID, project" /></label>
        <label className="f"><span>Financial year</span><select id="fy" name="fy" defaultValue={f.fy}><option value="">All years</option>{[...new Set([fyOf(), ...years])].map((y) => <option key={y} value={y}>FY {fyLabel(y)}</option>)}</select></label>
        <label className="f"><span>Status</span><select id="status" name="status" defaultValue={f.status}><option value="">All</option><option value="issued">Unpaid</option><option value="partial">Part paid</option><option value="paid">Paid</option><option value="cancelled">Cancelled</option></select></label>
        <label className="f"><span>Document</span><select id="type" name="type" defaultValue={f.type}><option value="">All</option><option value="invoice">Invoices</option><option value="credit_note">Credit notes</option></select></label>
        {brand.series.length > 1 && <label className="f"><span>Series</span><select id="series" name="series" defaultValue={f.series}><option value="">All</option>{brand.series.map((x) => <option key={x.code} value={x.code}>{x.label}</option>)}</select></label>}
        {chans.length > 0 && <label className="f"><span>Channel</span><select id="channel" name="channel" defaultValue={f.channel}><option value="">All</option>{chans.map((c) => <option key={c}>{c}</option>)}</select></label>}
        <label className="f"><span>From</span><input id="from" type="date" name="from" defaultValue={f.from} /></label>
        <label className="f"><span>To</span><input id="to" type="date" name="to" defaultValue={f.to} /></label>
        <button className="btn">Apply</button>
        <Link className="btn" href={`/b/${biz}`}>Reset</Link>
      </form>

      <div className="tablebox">
        {rows.length === 0 ? (
          <div className="empty"><b>No documents here yet</b>{qs && qs !== `fy=${fyOf()}` ? "Nothing matches these filters. Reset them to see everything." : "Issued invoices appear here with their number, customer and status."}</div>
        ) : (
          <table className="reg">
            <thead><tr><th>Number</th><th>Date</th><th>Customer</th><th>{extraHead}</th><th style={{ textAlign: "right" }}>Total</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const ser = seriesOf(brand, r.series);
                const ex = has(ser, "channel") ? [r.channel, r.order_id].filter(Boolean).join(" · ") : has(ser, "project") ? (r as unknown as { project: string }).project : has(ser, "enroll") ? (r as unknown as { first_item: string }).first_item : ser.label;
                const href = `/b/${biz}/inv/${r.id}`;
                return (
                  <tr key={r.id}>
                    <td className="n"><Link href={href}>{r.number}</Link>{r.origin === "W" && <span className="tag">Website</span>}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtDate(r.date)}</td>
                    <td><Link href={href}>{r.customer_name}</Link>{r.b2b && <span className="tag">B2B</span>}</td>
                    <td className="muted">{ex || ""}</td>
                    <td className="amt">{r.doc_type === "credit_note" ? "−" : ""}{money(r.grand, r.currency)}</td>
                    <td>{r.doc_type === "credit_note" && r.status !== "cancelled" ? <span className="pill credit">Credit note</span> : <span className={`pill ${r.status}`}>{STATUS[r.status]}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {rows.length >= 300 && <p className="hint">Showing the latest 300. Narrow the dates or search to find older ones. Exports always include everything that matches.</p>}
    </div>
  );
}
