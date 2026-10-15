"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Brand, UNITS, has, seriesOf } from "@/lib/brands";
import { CURRENCIES, Draft, GST_RATES, Item, STATES, STATE_NAME, Settings, blankDraft, blankItem, calc, creditCode, effRate, fmtN, fyLabel, fyOf, gstinValid, money, posOf, validate } from "@/lib/tax";
import { sheetHTML } from "@/lib/sheets";
import { createCreditNoteAction, createInvoiceAction, updateInvoiceAction } from "@/app/actions";
import SheetPreview from "./SheetPreview";

type CatalogItem = { name: string; hsn: string; gst: number; apparel: boolean; price: number; unit: string; note: string };
type Customer = { customer: Draft["customer"]; storeName: string; sellerId: string };
type Props = {
  brand: Brand; settings: Settings; catalog: CatalogItem[]; customers: Customer[]; next: Record<string, string>;
  mode: "new" | "edit" | "credit"; initial?: Draft; id?: string; number?: string;
  credit?: { refId: string; refNumber: string; refDate: string; room: number };
  docType?: "invoice" | "credit_note";
};

export default function InvoiceEditor(p: Props) {
  const { brand, settings, mode } = p;
  const router = useRouter();
  const storeKey = `ih-draft-${brand.key}`;
  const [d, setD] = useState<Draft>(() => p.initial || blankDraft(brand));
  const [error, setError] = useState<string | null>(null);
  const [saving, start] = useTransition();
  const isCN = mode === "credit" || p.docType === "credit_note";
  const s = seriesOf(brand, d.series);
  const L = s.labels || {};
  const supplierState = settings.stateCode || brand.business.stateCode;

  // Restore an unsaved new-invoice draft from this browser.
  useEffect(() => {
    if (mode !== "new" || p.initial) return;
    try { const saved = JSON.parse(localStorage.getItem(storeKey) || "null"); if (saved?.series && brand.series.some((x) => x.code === saved.series)) setD({ ...blankDraft(brand, saved.series), ...saved }); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (mode === "new") { try { localStorage.setItem(storeKey, JSON.stringify(d)); } catch {} } }, [d, mode, storeKey]);

  const c = useMemo(() => calc(d, brand, supplierState), [d, brand, supplierState]);
  const html = useMemo(() => sheetHTML({ brand, settings, d, number: mode === "new" || mode === "credit" ? null : p.number || null, docType: isCN ? "credit_note" : "invoice", ref: p.credit ? { number: p.credit.refNumber, date: p.credit.refDate } : null, status: d.status }), [brand, settings, d, mode, p.number, p.credit]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const setCust = (k: keyof Draft["customer"], v: string) => setD((x) => {
    const customer = { ...x.customer, [k]: v };
    if (k === "gstin") { const g = v.toUpperCase().trim(); if (g.length === 15 && gstinValid(g) && STATE_NAME[g.slice(0, 2)]) customer.stateCode = g.slice(0, 2); }
    return { ...x, customer };
  });
  const setShip = (k: keyof Draft["shipTo"], v: string) => setD((x) => ({ ...x, shipTo: { ...x.shipTo, [k]: v } }));
  const setItem = (i: number, patch: Partial<Item>) => setD((x) => ({ ...x, items: x.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }));

  function pickPreset(i: number, id: string) {
    const pr = s.presets.find((x) => x.id === id);
    setItem(i, pr ? { preset: id, hsn: pr.hsn, gst: pr.gst ?? 18, apparel: !!pr.apparel, unit: pr.unit || d.items[i].unit } : { preset: "", apparel: false });
  }
  function pickCatalog(i: number, name: string) {
    const ci = p.catalog.find((x) => x.name === name);
    if (!ci) return;
    const pr = s.presets.find((x) => (ci.apparel ? x.apparel : !x.apparel && x.hsn === ci.hsn && Number(x.gst) === Number(ci.gst)));
    setItem(i, { desc: ci.name, hsn: ci.hsn, gst: ci.gst, apparel: ci.apparel, rate: ci.price || "", unit: ci.unit || "Nos", note: ci.note || d.items[i].note, preset: pr?.id || "" });
  }
  function pickCustomer(name: string) {
    const m = p.customers.find((x) => x.customer?.name === name);
    if (m) setD((x) => ({ ...x, customer: { ...x.customer, ...m.customer }, storeName: m.storeName || x.storeName, sellerId: m.sellerId || x.sellerId }));
  }
  function changeSeries(code: string) {
    const ns = seriesOf(brand, code);
    setD((x) => ({ ...blankDraft(brand, code), customer: x.customer, date: x.date, items: [blankItem(ns)] }));
  }

  function save() {
    const err = validate(d, c) || (isCN && !d.reason.trim() ? "Give a reason for the credit note (for example, goods returned)." : null) || (mode === "credit" && p.credit && c.grand > p.credit.room + 0.001 ? `A credit note against ${p.credit.refNumber} can be at most ${money(p.credit.room, d.currency)}.` : null);
    if (err) { setError(err); return; }
    setError(null);
    start(async () => {
      const r = mode === "edit" ? await updateInvoiceAction(brand.key, p.id!, d)
        : mode === "credit" ? await createCreditNoteAction(brand.key, p.credit!.refId, d)
        : await createInvoiceAction(brand.key, d);
      if (!r.ok) { setError(r.error); return; }
      if (mode === "new") { try { localStorage.removeItem(storeKey); } catch {} }
      const id = (r.data as { id: string }).id;
      router.push(`/b/${brand.key}/inv/${id}${mode === "edit" ? "" : "?new=1"}`);
      router.refresh();
    });
  }

  const gOk = !d.customer.gstin || gstinValid(d.customer.gstin);
  const code = isCN ? creditCode(d.series) : d.series;
  const nextNo = mode === "edit" ? p.number : fyOf(d.date) === fyOf() ? p.next[code] : `${code}/G/${fyOf(d.date)}/…`;
  const title = mode === "edit" ? `Edit ${p.number}` : isCN ? `Credit note against ${p.credit?.refNumber}` : `New ${s.label.toLowerCase()}`;
  const autoPos = STATE_NAME[posOf({ ...d, posCode: "" }, brand, supplierState)] || "";

  return (
    <div className="editor">
      <div className="stack">
        <div className="row between">
          <h2>{title}</h2>
          {mode === "new" && <button className="btn sm" type="button" onClick={() => { setD(blankDraft(brand, d.series)); setError(null); }}>Clear form</button>}
        </div>
        <div className="numline">
          <div><div className="hint">{mode === "edit" ? "Number" : "Next number"}</div><b>{nextNo}</b></div>
          <div className="hint" style={{ maxWidth: 360 }}>{mode === "edit" ? "Numbers never change once issued. The date must stay in the same financial year." : `Assigned when you save, in strict sequence for FY ${fyLabel(fyOf(d.date))}.`}</div>
        </div>
        {mode === "credit" && <p className="notice">Use a credit note to reduce or reverse an invoice after it was issued (returns, discounts given later, overbilling). Enter only what you are crediting. At most {money(p.credit!.room, d.currency)} can still be credited on this invoice.</p>}

        <section className="card"><h3>{isCN ? "Credit note" : "Invoice"}</h3><div className="grid">
          {brand.series.length > 1 && mode === "new" && (
            <label className="f"><span>Invoice type</span><select id="series" value={d.series} onChange={(e) => changeSeries(e.target.value)}>{brand.series.map((x) => <option key={x.code} value={x.code}>{x.label} ({x.code})</option>)}</select></label>
          )}
          <label className="f"><span>Date</span><input id="date" type="date" value={d.date} onChange={(e) => set("date", e.target.value)} /></label>
          <label className="f"><span>Prices entered</span><select id="priceMode" value={d.priceMode} onChange={(e) => set("priceMode", e.target.value as Draft["priceMode"])}><option value="inclusive">Include GST</option><option value="exclusive">Exclude GST (+GST)</option></select></label>
          {mode === "new" && <label className="f"><span>Payment</span><select id="status" value={d.status} onChange={(e) => set("status", e.target.value as Draft["status"])}><option value="paid">Paid in full now</option><option value="issued">Not paid yet</option></select></label>}
          {isCN && <label className="f wide"><span>Reason</span><input id="reason" value={d.reason} onChange={(e) => set("reason", e.target.value)} placeholder="e.g. 1 piece returned damaged" /></label>}
          {has(s, "channel") && <>
            <label className="f"><span>Sold via</span><select id="channel" value={d.channel} onChange={(e) => set("channel", e.target.value)}>{(s.channels || []).map((x) => <option key={x}>{x}</option>)}</select></label>
            <label className="f"><span>Channel order ID</span><input id="orderId" value={d.orderId} onChange={(e) => set("orderId", e.target.value)} placeholder="e.g. 408-1234567-1234567" /></label>
          </>}
          {has(s, "project") && !isCN && <>
            <label className="f"><span>Due date</span><input id="dueDate" type="date" value={d.dueDate} onChange={(e) => set("dueDate", e.target.value)} /></label>
            <label className="f"><span>Currency</span><select id="currency" value={d.currency} onChange={(e) => set("currency", e.target.value)}>{Object.keys(CURRENCIES).map((x) => <option key={x}>{x}</option>)}</select></label>
            {d.currency !== "INR" && <>
              <label className="f"><span>1 {d.currency} in ₹</span><input id="fx" inputMode="decimal" value={d.fx} onChange={(e) => set("fx", e.target.value)} placeholder="e.g. 88.20" /></label>
              <label className="check wide"><input id="lut" type="checkbox" checked={d.lut !== false} onChange={(e) => set("lut", e.target.checked)} /> Export under LUT (zero-rated, no IGST)</label>
            </>}
          </>}
        </div></section>

        <section className="card"><h3>{L.customer || "Billed to"}</h3><div className="grid">
          <label className="f"><span>{L.name || "Name"}</span><input id="custName" list="customers" autoComplete="off" value={d.customer.name} onChange={(e) => setCust("name", e.target.value)} onBlur={(e) => pickCustomer(e.target.value)} /></label>
          <datalist id="customers">{p.customers.map((x, i) => <option key={i} value={x.customer?.name} />)}</datalist>
          {has(s, "seller") && <label className="f"><span>Store / brand name</span><input id="storeName" value={d.storeName} onChange={(e) => set("storeName", e.target.value)} /></label>}
          <label className="f"><span>Phone</span><input id="custPhone" inputMode="tel" value={d.customer.phone} onChange={(e) => setCust("phone", e.target.value)} /></label>
          <label className="f"><span>Email</span><input id="custEmail" inputMode="email" value={d.customer.email} onChange={(e) => setCust("email", e.target.value)} /></label>
          <label className="f"><span>GSTIN (if registered)</span><input id="custGstin" maxLength={15} style={{ textTransform: "uppercase" }} className={gOk ? "" : "bad"} value={d.customer.gstin} onChange={(e) => setCust("gstin", e.target.value)} />
            <span className={"hint" + (gOk ? "" : " bad")}>{d.customer.gstin ? (gOk ? "Valid GSTIN · B2B invoice" : "This GSTIN fails the checksum. Check for a typo.") : "Leave blank for a consumer (B2C)"}</span></label>
          <label className="f"><span>State</span><select id="custState" value={d.customer.stateCode} onChange={(e) => setCust("stateCode", e.target.value)}><option value="">Select state</option>{STATES.map(([k, n]) => <option key={k} value={k}>{k} · {n}</option>)}</select></label>
          <label className="f wide"><span>Address</span><textarea id="custAddr" value={d.customer.address} onChange={(e) => setCust("address", e.target.value)} /></label>
        </div></section>

        {has(s, "shipTo") && <section className="card"><h3>Ship to</h3>
          <label className="check"><input id="shipSame" type="checkbox" checked={d.shipSame} onChange={(e) => set("shipSame", e.target.checked)} /> Same as billing address</label>
          {!d.shipSame && <div className="grid" style={{ marginTop: 12 }}>
            <label className="f"><span>Name</span><input id="shipName" value={d.shipTo.name} onChange={(e) => setShip("name", e.target.value)} /></label>
            <label className="f"><span>State</span><select id="shipState" value={d.shipTo.stateCode} onChange={(e) => setShip("stateCode", e.target.value)}><option value="">Select state</option>{STATES.map(([k, n]) => <option key={k} value={k}>{k} · {n}</option>)}</select></label>
            <label className="f wide"><span>Address</span><textarea id="shipAddr" value={d.shipTo.address} onChange={(e) => setShip("address", e.target.value)} /></label>
          </div>}
        </section>}

        {has(s, "enroll") && <section className="card"><h3>Enrollment</h3><div className="grid">
          <label className="f"><span>Enrollment ID</span><input id="enrollId" value={d.enrollId} onChange={(e) => set("enrollId", e.target.value)} /></label>
          <label className="f"><span>Batch / start date</span><input id="batch" value={d.batch} onChange={(e) => set("batch", e.target.value)} placeholder="e.g. Live on Zoom, 30 Sep 7 pm" /></label>
        </div><p className="hint" style={{ marginBottom: 0 }}>The learner&apos;s email above prints as the course access email.</p></section>}

        {has(s, "project") && <section className="card"><h3>Project</h3><div className="grid">
          <label className="f"><span>Project</span><input id="project" value={d.project} onChange={(e) => set("project", e.target.value)} placeholder="e.g. Website + Meta ads launch" /></label>
          <label className="f"><span>Period / milestone</span><input id="period" value={d.period} onChange={(e) => set("period", e.target.value)} placeholder="e.g. Oct 2026 retainer" /></label>
          {!isCN && <label className="f"><span>Advance received before this invoice</span><input id="advance" inputMode="decimal" value={d.advance} onChange={(e) => set("advance", e.target.value)} /></label>}
        </div></section>}

        {has(s, "seller") && <section className="card"><h3>Enrollment plan</h3><div className="grid">
          <label className="f"><span>Seller ID</span><input id="sellerId" value={d.sellerId} onChange={(e) => set("sellerId", e.target.value)} /></label>
          <label className="f"><span>Plan</span><input id="plan" value={d.plan} onChange={(e) => set("plan", e.target.value)} placeholder="e.g. Annual Seller Plan" /></label>
          <label className="f"><span>Valid from</span><input id="validFrom" type="date" value={d.validFrom} onChange={(e) => set("validFrom", e.target.value)} /></label>
          <label className="f"><span>Valid to</span><input id="validTo" type="date" value={d.validTo} onChange={(e) => set("validTo", e.target.value)} /></label>
        </div></section>}

        <section className="card">
          <div className="row between" style={{ marginBottom: 10 }}><h3 style={{ margin: 0 }}>{s.itemHead}</h3><button type="button" className="btn sm" onClick={() => setD((x) => ({ ...x, items: [...x.items, blankItem(s)] }))}>Add line</button></div>
          <datalist id="catalog">{p.catalog.map((x) => <option key={x.name} value={x.name} />)}</datalist>
          <div className="items">
            {d.items.map((it, i) => {
              const row = c.rows.filter((r) => !r.ship)[i];
              return (
                <div className="item" key={i}>
                  <label className="f c-desc"><span>Description</span><input id={`it${i}desc`} list="catalog" autoComplete="off" value={it.desc} onChange={(e) => setItem(i, { desc: e.target.value })} onBlur={(e) => pickCatalog(i, e.target.value)} /></label>
                  <label className="f c-preset"><span>Tax class</span><select id={`it${i}preset`} value={it.preset} onChange={(e) => pickPreset(i, e.target.value)}><option value="">Custom</option>{s.presets.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
                  <label className="f c-note"><span>Details (optional)</span><input id={`it${i}note`} value={it.note} onChange={(e) => setItem(i, { note: e.target.value })} placeholder={s.notePh} /></label>
                  <label className="f c-hsn"><span>{s.kind === "goods" ? "HSN" : "SAC"}</span><input id={`it${i}hsn`} inputMode="numeric" value={it.hsn} onChange={(e) => setItem(i, { hsn: e.target.value })} /></label>
                  <label className="f c-qty"><span>Qty</span><input id={`it${i}qty`} inputMode="decimal" value={it.qty} onChange={(e) => setItem(i, { qty: e.target.value })} /></label>
                  <label className="f c-unit"><span>Unit</span><select id={`it${i}unit`} value={it.unit} onChange={(e) => setItem(i, { unit: e.target.value })}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select></label>
                  <label className="f c-rate"><span>{d.priceMode === "inclusive" ? "Price incl. GST" : "Rate"}</span><input id={`it${i}rate`} inputMode="decimal" value={it.rate} onChange={(e) => setItem(i, { rate: e.target.value })} /></label>
                  <label className="f c-disc"><span>Discount ₹</span><input id={`it${i}disc`} inputMode="decimal" value={it.disc} onChange={(e) => setItem(i, { disc: e.target.value })} /></label>
                  <label className="f c-gst"><span>GST %</span>{it.apparel
                    ? <input id={`it${i}gst`} value={`${effRate(it, d.priceMode)} (auto)`} disabled />
                    : <select id={`it${i}gst`} value={String(it.gst)} onChange={(e) => setItem(i, { gst: Number(e.target.value) })}>{GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}</select>}</label>
                  <div className="item-foot">
                    <span>{row ? <>Taxable <b>{fmtN(row.taxable)}</b> · GST {row.r}% <b>{fmtN(row.tax)}</b> · Line total <b>{fmtN(row.amount)}</b></> : ""}</span>
                    {d.items.length > 1 && <button type="button" className="btn sm danger" onClick={() => setD((x) => ({ ...x, items: x.items.filter((_, j) => j !== i) }))}>Remove</button>}
                  </div>
                </div>
              );
            })}
          </div>
          {has(s, "shipping") && <div className="grid" style={{ marginTop: 12 }}><label className="f"><span>Shipping charged</span><input id="shipping" inputMode="decimal" value={d.shipping} onChange={(e) => set("shipping", e.target.value)} placeholder="0" /><span className="hint">Takes the GST rate of the main item.</span></label></div>}
        </section>

        {has(s, "provenance") && <section className="card"><h3>Provenance</h3><label className="f"><span>Authenticity / provenance note (printed)</span><textarea id="provenance" value={d.provenance} onChange={(e) => set("provenance", e.target.value)} placeholder="e.g. Brass Nandi, c. 1910, Thanjavur. Certificate STA-CA-0142." /></label></section>}

        <section className="card"><h3>{isCN ? "Notes" : "Payment & notes"}</h3><div className="grid">
          {!isCN && <>
            <label className="f"><span>Payment mode</span><select id="paymentMode" value={d.paymentMode} onChange={(e) => set("paymentMode", e.target.value)}>{s.paymentModes.map((x) => <option key={x}>{x}</option>)}</select></label>
            <label className="f"><span>{s.refLabel}</span><input id="paymentRef" value={d.paymentRef} onChange={(e) => set("paymentRef", e.target.value)} /></label>
          </>}
          <label className="f"><span>Place of supply</span><select id="posCode" value={d.posCode} onChange={(e) => set("posCode", e.target.value)}><option value="">Auto · {autoPos}</option>{STATES.map(([k, n]) => <option key={k} value={k}>{k} · {n}</option>)}</select></label>
          <label className="f wide"><span>Notes printed on this document</span><textarea id="notes" value={d.notes} onChange={(e) => set("notes", e.target.value)} /></label>
        </div></section>

        <section className="card sumbar">
          <div><span>Taxable</span><b>{money(c.taxable, c.cur)}</b></div>
          <div><span>{c.zero ? "IGST (LUT)" : c.inter ? "IGST" : "CGST + SGST"}</span><b>{money(c.tax, c.cur)}</b></div>
          <div><span>Total</span><b>{money(c.grand, c.cur)}</b></div>
          {c.advance > 0 && <div><span>Balance due</span><b>{money(c.due, c.cur)}</b></div>}
        </section>

        <div className="actions">
          <button type="button" className="btn primary" disabled={saving} onClick={save}>{saving ? "Saving…" : mode === "edit" ? "Save changes" : isCN ? "Issue credit note" : "Save & issue"}</button>
          {mode !== "new" && <button type="button" className="btn" onClick={() => router.back()}>Cancel</button>}
          {error && <span className="err" role="alert">{error}</span>}
        </div>
      </div>
      <div className="preview-col"><SheetPreview html={html} label={<><span>Live preview · A4</span><span>{d.status === "paid" && mode === "new" ? "Will be marked paid" : ""}</span></>} /></div>
    </div>
  );
}
