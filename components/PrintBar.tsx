"use client";
import { useEffect } from "react";

/** Toolbar above a printable sheet. "Save as PDF" is the browser's own print destination. */
export default function PrintBar({ auto, backHref, payUri, payLabel }: { auto?: boolean; backHref?: string; payUri?: string | null; payLabel?: string }) {
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => { document.fonts?.ready.then(() => window.print()).catch(() => window.print()); }, 400);
    return () => clearTimeout(t);
  }, [auto]);
  return (
    <div className="print-bar no-print">
      <button className="btn primary" onClick={() => window.print()}>Download PDF / Print</button>
      {payUri && <a className="btn" href={payUri}>{payLabel || "Pay with UPI"}</a>}
      {backHref && <a className="btn" href={backHref}>Back</a>}
    </div>
  );
}
