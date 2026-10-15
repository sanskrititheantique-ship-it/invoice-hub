import Link from "next/link";
import { notFound } from "next/navigation";
import { brandOf } from "@/lib/brands";
import { can, requireAccess } from "@/lib/auth";
import BrandNav from "@/components/BrandNav";
import { logoutAction } from "@/app/actions";

export default async function BrandLayout({ children, params }: { children: React.ReactNode; params: Promise<{ biz: string }> }) {
  const { biz } = await params;
  const brand = brandOf(biz);
  if (!brand) notFound();
  const user = await requireAccess(biz, "viewer");
  return (
    <div className="brand-area" data-brand={biz}>
      <div className="top"><div className="wrap top-in">
        <Link href={`/b/${biz}`} className="brand"><span className="brand-name">{brand.name}</span><span className="brand-sub">Invoices</span></Link>
        <BrandNav biz={biz} canEdit={can(user, biz, "editor")} isAdmin={can(user, biz, "admin")} />
        <form action={logoutAction} className="who"><Link href="/">All businesses</Link><span>·</span><span>{user.email}</span><button className="linkbtn">Sign out</button></form>
      </div></div>
      <main className="wrap">{children}</main>
    </div>
  );
}
