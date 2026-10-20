"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addPaymentAction, cancelInvoiceAction, deleteInvoiceAction, deletePaymentAction, markPaidAction, markUnpaidAction, shareAction } from "@/app/actions";
import { fmtDate, money, todayISO } from "@/lib/tax";

type Pay = { id: number; date: string; amount: number; mode: string; ref: string; note: string };
type Props = {
  biz: string; id: string; number: string; docType: "invoice" | "credit_note"; status: string; currency: string;
  balance: number; grand: number; customerName: string; customerPhone: string; brandName: string; upi: string;
  shareToken: string | null; appUrl: string; canEdit: boolean; payments: Pay[]; paymentModes: string[];
  credits: { id: string; number: string; date: string; grand: number; status: string }[];
  against: { id: string; number: string; date: string } | null;
  canDelete: boolean; deleteReason: string;
};

export default function InvoiceActions(p: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reason, setReason] = useState("");
  const [pay, setPay] = useState({ date: todayISO(), amount: p.balance > 0 ? String(p.balance) : "", mode: p.paymentModes[0] || "UPI", ref: "", note: "" });
  const cancelled = p.status === "cancelled";
  const isInvoice = p.docType === "invoice";
  const shareUrl = p.shareToken ? `${p.appUrl}/i/${p.shareToken}` : "";

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: done } : { ok: false, text: r.error || "Something went wrong." });
      if (r.ok) router.refresh();
    });

  async function copy(text: string, done: string) {
    try { await navigator.clipboard.writeText(text); setMsg({ ok: true, text: done }); }
    catch { setMsg({ ok: false, text: "Copying is blocked in this browser. Select the text and copy it." }); }
  }
  function waText() {
    const lines = [`Hi ${p.customerName},`, "", `${p.status === "paid" ? "Thank you! Here's your" : "Here's your"} ${isInvoice ? "invoice" : "credit note"} ${p.number} from ${p.brandName}.`];
    if (isInvoice) lines.push(p.status === "paid" ? `Amount paid: ${money(p.grand, p.currency)}` : `Amount due: ${money(p.balance, p.currency)}`);
    if (isInvoice && p.status !== "paid" && p.upi) lines.push(`UPI: ${p.upi}`);
    if (shareUrl) lines.push("", `View or download: ${shareUrl}`);
    return lines.join("\n");
  }
  const waLink = () => {
    const phone = p.customerPhone.replace(/\D/g, "");
    const to = phone.length === 10 ? "91" + phone : phone;
    return `https://wa.me/${to}?text=${encodeURIComponent(waText())}`;
  };

  return (
    <div className="side">
      {msg && <p className={`notice ${msg.ok ? "ok" : "bad"}`} role="status">{msg.text}</p>}

      <section className="card stack" style={{ gap: 10 }}>
        <h3 style={{ margin: 0 }}>Send</h3>
        <div className="row">
          <a className="btn primary" href={`/print/${p.id}?auto=1`} target="_blank" rel="noreferrer">Download PDF</a>
          {p.canEdit && !cancelled && <button className="btn" disabled={pending} onClick={() => run(() => shareAction(p.biz, p.id, !p.shareToken), p.shareToken ? "Link turned off." : "Share link created.")}>{p.shareToken ? "Turn off link" : "Create share link"}</button>}
        </div>
        {shareUrl && <div className="copyline"><input id="shareUrl" readOnly value={shareUrl} onFocus={(e) => e.target.select()} /><button className="btn sm" onClick={() => copy(shareUrl, "Link copied.")}>Copy</button></div>}
        <div className="row">
          <button className="btn sm" onClick={() => copy(waText(), "Message copied. Paste it in WhatsApp.")}>Copy WhatsApp message</button>
          {p.customerPhone && <a className="btn sm" href={waLink()} target="_blank" rel="noreferrer">Open in WhatsApp</a>}
        </div>
        <p className="hint" style={{ margin: 0 }}>PDF opens a print view: choose &ldquo;Save as PDF&rdquo;. Anyone with the share link can view this document without signing in.</p>
      </section>

      {isInvoice && (
        <section className="card stack" style={{ gap: 10 }}>
          <div className="row between"><h3 style={{ margin: 0 }}>Payments</h3><span className="muted" style={{ fontSize: 13 }}>Balance <b>{money(p.balance, p.currency)}</b></span></div>
          {p.payments.length ? (
            <ul className="plist">{p.payments.map((x) => (
              <li key={x.id}><span>{fmtDate(x.date)} · {x.mode}{x.ref ? ` · ${x.ref}` : ""}</span><span>{money(x.amount, p.currency)}{p.canEdit && !cancelled && <> <button className="linkbtn" disabled={pending} onClick={() => run(() => deletePaymentAction(p.biz, x.id), "Payment removed.")}>Remove</button></>}</span></li>
            ))}</ul>
          ) : <p className="hint" style={{ margin: 0 }}>No payments recorded.</p>}
          {p.canEdit && !cancelled && (p.balance > 0 || p.payments.length > 0) && (
            <div className="row">
              {p.balance > 0 && <button className="btn sm primary" disabled={pending} onClick={() => run(() => markPaidAction(p.biz, p.id), "Marked paid.")}>Mark paid</button>}
              {p.payments.length > 0 && <button className="btn sm" disabled={pending} onClick={() => run(() => markUnpaidAction(p.biz, p.id), "Marked unpaid. All payments on it were removed.")}>Mark unpaid</button>}
            </div>
          )}
          {p.canEdit && !cancelled && p.balance > 0 && (
            <div className="grid">
              <label className="f"><span>Amount</span><input id="payAmount" inputMode="decimal" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></label>
              <label className="f"><span>Date</span><input id="payDate" type="date" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} /></label>
              <label className="f"><span>Mode</span><select id="payMode" value={pay.mode} onChange={(e) => setPay({ ...pay, mode: e.target.value })}>{p.paymentModes.map((m) => <option key={m}>{m}</option>)}</select></label>
              <label className="f"><span>Reference</span><input id="payRef" value={pay.ref} onChange={(e) => setPay({ ...pay, ref: e.target.value })} placeholder="UTR / transaction ID" /></label>
              <div className="wide"><button className="btn" disabled={pending} onClick={() => run(() => addPaymentAction(p.biz, p.id, { ...pay, amount: Number(pay.amount) }), "Payment recorded.")}>Record part payment</button></div>
            </div>
          )}
        </section>
      )}

      {isInvoice && (p.credits.length > 0 || (p.canEdit && !cancelled)) && (
        <section className="card stack" style={{ gap: 10 }}>
          <h3 style={{ margin: 0 }}>Credit notes</h3>
          {p.credits.length ? <ul className="plist">{p.credits.map((c) => <li key={c.id}><Link href={`/b/${p.biz}/inv/${c.id}`}>{c.number}</Link><span>{c.status === "cancelled" ? "Cancelled" : "−" + money(c.grand, p.currency)}</span></li>)}</ul> : <p className="hint" style={{ margin: 0 }}>Use a credit note for returns, later discounts or overbilling. It keeps the original invoice intact, as GST requires.</p>}
          {p.canEdit && !cancelled && <Link className="btn sm" href={`/b/${p.biz}/new?credit=${p.id}`}>Issue credit note</Link>}
        </section>
      )}
      {!isInvoice && p.against && <section className="card"><h3>Against invoice</h3><Link href={`/b/${p.biz}/inv/${p.against.id}`}>{p.against.number}</Link> <span className="muted">dated {fmtDate(p.against.date)}</span></section>}

      {p.canEdit && (
        <section className="card stack" style={{ gap: 10 }}>
          <h3 style={{ margin: 0 }}>Fix or reuse</h3>
          <div className="row">
            {!cancelled && <Link className="btn sm" href={`/b/${p.biz}/inv/${p.id}/edit`}>Edit</Link>}
            {isInvoice && <Link className="btn sm" href={`/b/${p.biz}/new?from=${p.id}`}>Duplicate as new</Link>}
            {!cancelled && <button className="btn sm danger" onClick={() => { setConfirmCancel(true); setConfirmDelete(false); }}>Cancel {isInvoice ? "invoice" : "credit note"}</button>}
            {p.canDelete && <button className="btn sm danger" onClick={() => { setConfirmDelete(true); setConfirmCancel(false); }}>Delete</button>}
          </div>
          <p className="hint" style={{ margin: 0 }}>Made a mistake? Edit fixes details before you file GST returns. After filing, issue a credit note. Cancel keeps the number, marked cancelled. {p.canDelete ? "Delete removes this invoice completely, because it is the latest in its series." : `Delete isn't available: ${p.deleteReason}`}</p>
          {confirmDelete && (
            <div className="confirm">
              <b>Delete {p.number} completely?</b>
              <span className="hint">It disappears from the register, and the next invoice you make gets this same number. Only do this if you haven't sent it to the customer. If you have, cancel it instead.</span>
              <div className="row">
                <button className="btn danger sm" disabled={pending} onClick={() => start(async () => {
                  const r = await deleteInvoiceAction(p.biz, p.id);
                  if (!r.ok) { setMsg({ ok: false, text: r.error }); setConfirmDelete(false); return; }
                  router.push(`/b/${p.biz}?deleted=${encodeURIComponent(p.number)}`); router.refresh();
                })}>Delete it</button>
                <button className="btn sm" onClick={() => setConfirmDelete(false)}>Keep it</button>
              </div>
            </div>
          )}
          {confirmCancel && (
            <div className="confirm">
              <b>Cancel {p.number}?</b>
              <span className="hint">The number stays in the register marked cancelled and is never reused. Remove any recorded payments first.</span>
              <label className="f"><span>Reason</span><input id="cancelReason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Order cancelled by customer" /></label>
              <div className="row">
                <button className="btn danger sm" disabled={pending} onClick={() => { run(() => cancelInvoiceAction(p.biz, p.id, reason), "Cancelled."); setConfirmCancel(false); }}>Cancel it</button>
                <button className="btn sm" onClick={() => setConfirmCancel(false)}>Keep it</button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
