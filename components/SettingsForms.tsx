"use client";
import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GST_RATES, STATES, Settings, gstinValid } from "@/lib/tax";
import { UNITS } from "@/lib/brands";
import { changePasswordAction, createApiKeyAction, revokeApiKeyAction, saveCatalogAction, saveSettingsAction, setNextNumberAction } from "@/app/actions";

type Msg = { ok: boolean; text: string } | null;
function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>, done: string, after?: (d: unknown) => void) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: done } : { ok: false, text: r.error || "Something went wrong." });
      if (r.ok) { after?.(r.data); router.refresh(); }
    });
  return { pending, msg, run };
}
const Note = ({ msg }: { msg: Msg }) => (msg ? <p className={`notice ${msg.ok ? "ok" : "bad"}`} role="status" style={{ margin: 0 }}>{msg.text}</p> : null);

const BIZ: [string, string][] = [["legalName", "Legal name (as on GST certificate)"], ["tradeName", "Trade / brand name"], ["gstin", "GSTIN"], ["phone", "Phone"], ["email", "Email"], ["website", "Website"], ["signatory", "Authorised signatory name"]];
const BANK: [string, string][] = [["bankName", "Bank name"], ["accName", "Account holder name"], ["account", "Account number"], ["ifsc", "IFSC"], ["upi", "UPI ID (prints a pay QR on unpaid invoices)"], ["swift", "SWIFT code (foreign clients)"], ["lut", "LUT ARN (export invoices)"]];

export function BusinessForm({ biz, initial }: { biz: string; initial: Settings }) {
  const [v, setV] = useState<Settings>(initial);
  const { pending, msg, run } = useRun();
  const g = (v.gstin || "").toUpperCase().trim();
  const gMsg = !g ? "Add your GSTIN so it prints on every invoice." : !gstinValid(g) ? "This GSTIN fails the checksum. Check for a typo." : g.slice(0, 2) !== v.stateCode ? `This GSTIN is registered in state ${g.slice(0, 2)}, but the state below is ${v.stateCode}.` : "GSTIN is valid.";
  const field = (k: string, label: string) => (
    <label className="f" key={k}><span>{label}</span><input id={`s-${k}`} value={v[k] || ""} onChange={(e) => setV({ ...v, [k]: e.target.value })} style={k === "gstin" ? { textTransform: "uppercase" } : undefined} maxLength={k === "gstin" ? 15 : undefined} /></label>
  );
  function save() {
    const data = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, String(x ?? "").trim()]));
    data.gstin = (data.gstin || "").toUpperCase();
    if (data.gstin && !gstinValid(data.gstin)) return run(async () => ({ ok: false, error: "Fix the GSTIN before saving." }), "");
    run(() => saveSettingsAction(biz, data), "Settings saved. They print on every invoice from now on.");
  }
  return (
    <div className="stack">
      <section className="card"><h3>Business</h3><div className="grid">
        {BIZ.map(([k, l]) => field(k, l))}
        <label className="f"><span>State of registration</span><select id="s-stateCode" value={v.stateCode} onChange={(e) => setV({ ...v, stateCode: e.target.value })}>{STATES.filter(([k]) => k !== "96").map(([k, n]) => <option key={k} value={k}>{k} · {n}</option>)}</select></label>
        <label className="f wide"><span>Registered address</span><textarea id="s-address" value={v.address || ""} onChange={(e) => setV({ ...v, address: e.target.value })} /></label>
      </div><p className={"hint" + (g && gMsg !== "GSTIN is valid." ? " bad" : "")} style={{ marginBottom: 0 }}>{gMsg}</p></section>
      <section className="card"><h3>Getting paid</h3><div className="grid">{BANK.map(([k, l]) => field(k, l))}</div></section>
      <section className="card"><h3>Standard terms</h3><label className="f"><span>Printed on every invoice</span><textarea id="s-terms" style={{ minHeight: 90 }} value={v.terms || ""} onChange={(e) => setV({ ...v, terms: e.target.value })} /></label></section>
      <div className="row"><button className="btn primary" disabled={pending} onClick={save}>Save settings</button><Note msg={msg} /></div>
    </div>
  );
}

export function SeriesForm({ biz, rows }: { biz: string; rows: { code: string; label: string; origin: string; next: string; used: number }[] }) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const { pending, msg, run } = useRun();
  return (
    <section className="card">
      <h3>Number series</h3>
      <p className="hint">Format: code / source / year / sequence. <b>G</b> marks invoices made here, <b>W</b> marks invoices your website issues through the API. Sequences restart on 1 April.</p>
      {rows.map((r) => {
        const k = r.code + r.origin;
        return (
          <div className="series-row" key={k}>
            <div style={{ flex: 1, minWidth: 0 }}><div className="code">{r.next}</div><div className="hint">{r.label} · {r.origin === "G" ? "made here" : "from website"} · {r.used} used this year</div></div>
            <label className="f" style={{ width: 110 }}><span>Next number</span><input id={`n-${k}`} inputMode="numeric" value={vals[k] || ""} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} /></label>
            <button className="btn sm" disabled={pending} onClick={() => run(() => setNextNumberAction(biz, r.code, r.origin, parseInt(vals[k] || "", 10)), "Next number updated.")}>Set</button>
          </div>
        );
      })}
      <p className="hint" style={{ marginBottom: 0 }}>Only set a start number when moving an existing series here (for example, 0001 to 0012 were issued elsewhere this year, so set 13).</p>
      <Note msg={msg} />
    </section>
  );
}

type Cat = { name: string; hsn: string; gst: number; apparel: boolean; price: number; unit: string; note: string };
export function CatalogForm({ biz, initial }: { biz: string; initial: Cat[] }) {
  const [items, setItems] = useState<Cat[]>(initial);
  const { pending, msg, run } = useRun();
  const up = (i: number, patch: Partial<Cat>) => setItems(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <section className="card">
      <h3>Saved items</h3>
      <p className="hint">Type the name in an invoice line to fill its code, GST rate and price.</p>
      {items.length > 0 && <div className="cat-row hint"><span>Name</span><span>HSN/SAC</span><span>GST</span><span>Price</span><span>Unit</span><span /></div>}
      {items.map((x, i) => (
        <div className="cat-row" key={i}>
          <input aria-label="Name" value={x.name} onChange={(e) => up(i, { name: e.target.value })} />
          <input aria-label="HSN or SAC" value={x.hsn} onChange={(e) => up(i, { hsn: e.target.value })} />
          <select aria-label="GST rate" value={x.apparel ? "apparel" : String(x.gst)} onChange={(e) => up(i, e.target.value === "apparel" ? { apparel: true } : { apparel: false, gst: Number(e.target.value) })}>
            {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}<option value="apparel">Garment rule</option>
          </select>
          <input aria-label="Price" inputMode="decimal" value={x.price} onChange={(e) => up(i, { price: e.target.value as unknown as number })} />
          <select aria-label="Unit" value={x.unit} onChange={(e) => up(i, { unit: e.target.value })}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
          <button className="btn sm danger" aria-label="Remove" onClick={() => setItems(items.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn sm" onClick={() => setItems([...items, { name: "", hsn: "", gst: 18, apparel: false, price: 0, unit: "Nos", note: "" }])}>Add item</button>
        <button className="btn sm primary" disabled={pending} onClick={() => run(() => saveCatalogAction(biz, items.map((x) => ({ ...x, price: Number(x.price) || 0 }))), "Items saved.")}>Save items</button>
      </div>
      <Note msg={msg} />
    </section>
  );
}

export function ApiKeysForm({ biz, keys, appUrl }: { biz: string; keys: { id: number; name: string; prefix: string; created_at: string; revoked_at: string | null }[]; appUrl: string }) {
  const [name, setName] = useState("Website checkout");
  const [fresh, setFresh] = useState<string | null>(null);
  const { pending, msg, run } = useRun();
  return (
    <section className="card stack" style={{ gap: 10 }}>
      <h3 style={{ margin: 0 }}>Website connection</h3>
      <p className="hint" style={{ margin: 0 }}>Your store can issue invoices automatically: <code>POST {appUrl}/api/v1/invoices</code> with <code>Authorization: Bearer &lt;key&gt;</code>. Those invoices use the W series.</p>
      <div className="row"><input id="keyName" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1, minWidth: 160 }} /><button className="btn sm" disabled={pending} onClick={() => run(() => createApiKeyAction(biz, name), "Key created. Copy it now: it won't be shown again.", (d) => setFresh(String(d)))}>Create key</button></div>
      {fresh && <div className="keybox">{fresh}</div>}
      {keys.length > 0 && <ul className="plist">{keys.map((k) => (
        <li key={k.id}><span>{k.name} · <code>{k.prefix}…</code></span><span>{k.revoked_at ? <span className="muted">Revoked</span> : <button className="linkbtn" disabled={pending} onClick={() => run(() => revokeApiKeyAction(biz, k.id), "Key revoked.")}>Revoke</button>}</span></li>
      ))}</ul>}
      <Note msg={msg} />
    </section>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, {} as { error?: string; ok?: boolean });
  return (
    <section className="card">
      <h3>Your password</h3>
      <form action={action} className="grid">
        <label className="f"><span>Current password</span><input id="pw-cur" name="current" type="password" autoComplete="current-password" required /></label>
        <label className="f"><span>New password</span><input id="pw-new" name="next" type="password" autoComplete="new-password" minLength={10} required /></label>
        <div className="wide row"><button className="btn sm" disabled={pending}>Change password</button>{state?.error && <span className="err">{state.error}</span>}{state?.ok && <span className="muted">Password changed.</span>}</div>
      </form>
    </section>
  );
}
