"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Brand } from "@/lib/brands";
import { DEFAULT_SIG_TEXT, DEFAULT_THANKS, LayoutPatch, SIG_OPTIONS, ShowKey, optionsFor, resolveLayout, sanitizePatch } from "@/lib/layout";
import { Draft, Settings, blankDraft, numFmt, fyOf } from "@/lib/tax";
import { sheetHTML } from "@/lib/sheets";
import { saveLayoutAction } from "@/app/actions";
import SheetPreview from "./SheetPreview";

/** Shrinks an uploaded image in the browser so it stays small in the database. */
async function shrink(file: File, maxW: number, maxH: number): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("Use a PNG, JPG or WebP image.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error("That image couldn't be read.")); i.src = url; });
    const k = Math.min(1, maxW / img.width, maxH / img.height);
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    let out = c.toDataURL("image/png");
    if (out.length > 380_000) out = c.toDataURL("image/webp", 0.9);
    if (out.length > 380_000) throw new Error("That image is too detailed. Try a smaller or simpler file.");
    return out;
  } finally { URL.revokeObjectURL(url); }
}

function sample(brand: Brand, series: string): Draft {
  const d = blankDraft(brand, series);
  const s = brand.series.find((x) => x.code === series)!;
  const p = s.presets[0];
  d.customer = { name: "Sample Customer", phone: "98100 00000", email: "customer@example.com", gstin: "", address: "12 Sample Street\nNew Delhi 110001", stateCode: "07" };
  d.items = [{ desc: "Sample item", note: "Details line, e.g. colour or scope", preset: p?.id || "", hsn: p?.hsn || "", qty: 1, unit: p?.unit || "Nos", rate: 1180, disc: 100, gst: p?.gst ?? 18, apparel: false }];
  d.orderId = "ORDER-1001"; d.paymentRef = "pay_ABC123"; d.project = "Website launch"; d.period = "October 2026";
  d.enrollId = "ENR-0042"; d.batch = "Live on Zoom, 30 Oct"; d.provenance = "Brass Nandi, c. 1910, Thanjavur.";
  d.notes = "Notes typed on this invoice appear here.";
  return d;
}

export default function LayoutForm({ brand, settings }: { brand: Brand; settings: Settings }) {
  const router = useRouter();
  const [patch, setPatch] = useState<LayoutPatch>(() => { try { return sanitizePatch(JSON.parse(settings.layout || "{}")); } catch { return {}; } });
  const [logoImg, setLogo] = useState(settings.logoImg || "");
  const [sigImg, setSig] = useState(settings.sigImg || "");
  const [series, setSeries] = useState(brand.series[0].code);
  const [paid, setPaid] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const logoRef = useRef<HTMLInputElement>(null), sigRef = useRef<HTMLInputElement>(null);

  const L = resolveLayout(brand.template, JSON.stringify(patch));
  const opts = optionsFor(brand, undefined, !!logoImg);
  const groups = [...new Set(opts.map((o) => o.group))];
  const html = useMemo(() => sheetHTML({
    brand, settings: { ...settings, layout: JSON.stringify(patch), logoImg, sigImg },
    d: sample(brand, series), number: numFmt(series, "G", fyOf(), 1), status: paid ? "paid" : "issued", paid: 0,
  }), [brand, settings, patch, logoImg, sigImg, series, paid]);

  const toggle = (k: ShowKey, on: boolean) => setPatch((p) => ({ ...p, show: { ...p.show, [k]: on } }));
  async function upload(file: File | undefined, kind: "logo" | "sig") {
    if (!file) return;
    try {
      const data = kind === "logo" ? await shrink(file, 640, 200) : await shrink(file, 480, 160);
      if (kind === "logo") { setLogo(data); toggle("logoImage", true); } else { setSig(data); setPatch((p) => ({ ...p, sig: "image" })); }
      setMsg({ ok: true, text: "Image added. Save to keep it." });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  }
  function save() {
    start(async () => {
      const r = await saveLayoutAction(brand.key, { layout: patch, logoImg, sigImg });
      setMsg(r.ok ? { ok: true, text: "Layout saved. Every invoice without its own changes now prints this way." } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });
  }

  return (
    <section className="card layout-card">
      <div className="layout-grid">
        <div className="stack" style={{ gap: 16 }}>
          <div>
            <h3 style={{ marginBottom: 4 }}>Invoice layout</h3>
            <p className="hint" style={{ margin: 0 }}>Choose what prints on {brand.name} invoices. Changes show in the preview right away. You can still change these on a single invoice while creating or editing it.</p>
          </div>

          <fieldset className="opt-group">
            <legend>Signature area</legend>
            {SIG_OPTIONS.map((o) => (
              <label key={o.value} className="radio">
                <input type="radio" name="sig" value={o.value} checked={L.sig === o.value} onChange={() => setPatch((p) => ({ ...p, sig: o.value }))} />
                <span><b>{o.label}</b><small>{o.hint}</small></span>
              </label>
            ))}
            {L.sig === "digital" && (
              <label className="f"><span>Text printed instead of a signature</span>
                <input id="sigText" value={patch.sigText ?? ""} placeholder={DEFAULT_SIG_TEXT} onChange={(e) => setPatch((p) => ({ ...p, sigText: e.target.value }))} /></label>
            )}
            {(L.sig === "image" || sigImg) && (
              <div className="upload-row">
                {sigImg ? <img src={sigImg} alt="Signature" className="thumb" /> : <span className="hint">No signature uploaded yet.</span>}
                <button type="button" className="btn sm" onClick={() => sigRef.current?.click()}>{sigImg ? "Replace signature" : "Upload signature or stamp"}</button>
                {sigImg && <button type="button" className="btn sm danger" onClick={() => setSig("")}>Remove</button>}
                <input ref={sigRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { upload(e.target.files?.[0], "sig"); e.target.value = ""; }} />
              </div>
            )}
          </fieldset>

          {groups.map((g) => (
            <fieldset className="opt-group" key={g}>
              <legend>{g}</legend>
              {opts.filter((o) => o.group === g).map((o) => (
                <label key={o.key} className="check"><input type="checkbox" checked={L.show[o.key]} onChange={(e) => toggle(o.key, e.target.checked)} /> {o.label}</label>
              ))}
              {g === "Header" && (
                <div className="upload-row">
                  {logoImg ? <img src={logoImg} alt="Logo" className="thumb" /> : <span className="hint">Using the {brand.name} wordmark.</span>}
                  <button type="button" className="btn sm" onClick={() => logoRef.current?.click()}>{logoImg ? "Replace logo" : "Upload logo"}</button>
                  {logoImg && <button type="button" className="btn sm danger" onClick={() => setLogo("")}>Remove</button>}
                  <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { upload(e.target.files?.[0], "logo"); e.target.value = ""; }} />
                </div>
              )}
              {g === "Bottom" && L.show.footer && (
                <label className="f"><span>Footer thank-you line</span>
                  <input id="thanks" value={patch.thanks ?? DEFAULT_THANKS[brand.template]} onChange={(e) => setPatch((p) => ({ ...p, thanks: e.target.value }))} placeholder="Leave empty for none" /></label>
              )}
            </fieldset>
          ))}

          <p className="hint" style={{ margin: 0 }}><i>Always printed, because a GST tax invoice must show them: your name, address and GSTIN; invoice number and date; customer name and address (and GSTIN if registered); place of supply; reverse charge; HSN/SAC, quantity, value, tax rate and tax amount.</i></p>

          <div className="row">
            <button className="btn primary" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save layout"}</button>
            <button className="btn" type="button" onClick={() => { setPatch({}); setMsg({ ok: true, text: "Back to the original layout. Save to keep it." }); }}>Reset to original</button>
          </div>
          {msg && <p className={`notice ${msg.ok ? "ok" : "bad"}`} role="status" style={{ margin: 0 }}>{msg.text}</p>}
        </div>

        <div className="layout-preview">
          <div className="row" style={{ marginBottom: 8 }}>
            {brand.series.length > 1 && <select aria-label="Preview type" value={series} onChange={(e) => setSeries(e.target.value)} style={{ width: "auto" }}>{brand.series.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}</select>}
            <select aria-label="Preview status" value={paid ? "paid" : "unpaid"} onChange={(e) => setPaid(e.target.value === "paid")} style={{ width: "auto" }}><option value="unpaid">Unpaid invoice</option><option value="paid">Paid invoice</option></select>
          </div>
          <SheetPreview html={html} label={<><span>Preview with sample data</span><span /></>} />
        </div>
      </div>
    </section>
  );
}
