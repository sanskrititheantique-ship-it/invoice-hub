import { requireAccess } from "@/lib/auth";
import { brandOf } from "@/lib/brands";
import LayoutForm from "@/components/LayoutForm";
import { getSettings, listApiKeys, listCatalog, seriesStatus } from "@/lib/invoices";
import { appUrl } from "@/lib/url";
import { ApiKeysForm, BusinessForm, CatalogForm, PasswordForm, SeriesForm } from "@/components/SettingsForms";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: { params: Promise<{ biz: string }> }) {
  const { biz } = await params;
  await requireAccess(biz, "admin");
  const [settings, catalog, series, keys] = await Promise.all([getSettings(biz), listCatalog(biz), seriesStatus(biz), listApiKeys(biz)]);
  return (
    <div className="stack">
      <div><h2>Settings</h2><p className="muted" style={{ margin: "4px 0 0" }}>These details print on every invoice for this business.</p></div>
      <LayoutForm brand={brandOf(biz)!} settings={settings} />
      <div className="set-grid">
        <BusinessForm biz={biz} initial={settings} />
        <div className="stack">
          <SeriesForm biz={biz} rows={series} />
          <CatalogForm biz={biz} initial={catalog.map((c) => ({ ...c, gst: Number(c.gst), price: Number(c.price) }))} />
          <ApiKeysForm biz={biz} keys={keys.map((k) => ({ ...k, created_at: String(k.created_at), revoked_at: k.revoked_at ? String(k.revoked_at) : null }))} appUrl={await appUrl()} />
          <PasswordForm />
        </div>
      </div>
    </div>
  );
}
