import Link from "next/link";
import { BRANDS } from "@/lib/brands";
import { can, requireUser } from "@/lib/auth";
import { stats } from "@/lib/invoices";
import { fmtN, fyLabel, fyOf } from "@/lib/tax";
import { logoutAction } from "./actions";
import FindBox from "@/components/FindBox";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireUser();
  const { denied } = await searchParams;
  const fy = fyOf();
  const mine = BRANDS.filter((b) => can(user, b.key, "viewer"));
  const rows = await Promise.all(mine.map(async (b) => ({ b, s: await stats(b.key, { fy }) })));
  return (
    <>
      <div className="top"><div className="wrap top-in">
        <div className="brand"><span className="brand-name">Invoice Hub</span><span className="brand-sub">FY {fyLabel(fy)}</span></div>
        <FindBox />
        <form action={logoutAction} className="who"><span>{user.email}</span><button className="linkbtn">Sign out</button></form>
      </div></div>
      <main className="wrap">
        {denied && <p className="notice bad">You don&apos;t have access to that business. Ask the owner to add it to your account.</p>}
        {!mine.length && <p className="notice">Your account has no businesses yet. Ask the owner to give you access.</p>}
        <div className="hub-grid">
          {rows.map(({ b, s }) => (
            <Link key={b.key} href={`/b/${b.key}`} className="hub-card" data-brand={b.key}>
              <span className="brand-name">{b.name}</span>
              <span className="muted">{b.business.legalName} · {b.series.map((x) => x.code).join(", ")}</span>
              <dl>
                <dt>Invoices this year</dt><dd>{s.n}</dd>
                <dt>Taxable value</dt><dd>₹{fmtN(s.taxable)}</dd>
                <dt>GST charged</dt><dd>₹{fmtN(s.tax)}</dd>
                <dt>Outstanding</dt><dd>₹{fmtN(s.outstanding)}</dd>
              </dl>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
