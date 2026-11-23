"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_TERMS,
  FIELDS,
  FieldDef,
  GROUPS,
  InternshipPayload,
  InternshipStatus,
  STATUSES,
  Term,
  formatRef,
} from "@/lib/internship-fields";
import { DOC_LABEL, DocKind, docHTML } from "@/lib/internship-sheets";
import { saveInternshipAction } from "@/app/actions";
import SheetPreview from "./SheetPreview";

type Props = {
  biz: string;
  id?: string;
  refCode?: string;
  status?: InternshipStatus;
  initial: InternshipPayload;
  canEdit: boolean;
};

const STATUS_LABEL: Record<InternshipStatus, string> = { draft: "Draft", active: "Active", completed: "Completed", ended: "Ended early" };
const DOC_TAG: Record<string, string> = { offer: "Offer", agreement: "Agreement", certificate: "Certificate" };
const PREVIEWS: DocKind[] = ["offer", "agreement", "certificate"];
const DOWNLOADS: DocKind[] = ["offer", "agreement", "both", "certificate"];

export default function InternshipEditor(props: Props) {
  const { biz, canEdit } = props;
  const router = useRouter();
  const [p, setP] = useState<InternshipPayload>(props.initial);
  const [status, setStatus] = useState<InternshipStatus>(props.status || "active");
  const [id, setId] = useState(props.id);
  const [refCode, setRefCode] = useState(props.refCode || "");
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [view, setView] = useState<DocKind>("offer");
  const [saving, start] = useTransition();

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2600); return () => clearTimeout(t); }, [toast]);

  const touch = (fn: (x: InternshipPayload) => InternshipPayload) => { setP(fn); setDirty(true); };
  const setField = (k: string, val: string) => touch((x) => ({ ...x, fields: { ...x.fields, [k]: val } }));
  const setShow = (k: string, on: boolean) => touch((x) => ({ ...x, show: { ...x.show, [k]: on } }));
  const setTerm = (i: number, patch: Partial<Term>) => touch((x) => ({ ...x, terms: x.terms.map((t, j) => (j === i ? { ...t, ...patch } : t)) }));
  const moveTerm = (i: number, d: number) => touch((x) => {
    const j = i + d; if (j < 0 || j >= x.terms.length) return x;
    const terms = [...x.terms]; [terms[i], terms[j]] = [terms[j], terms[i]]; return { ...x, terms };
  });

  const html = useMemo(() => docHTML(view, { p, refCode, draft: true }), [view, p, refCode]);

  /** Saves, then returns the saved record (new records get their id and reference number here). */
  async function save(): Promise<{ id: string; refCode: string } | null> {
    setError(null);
    const r = await saveInternshipAction(biz, id || null, p, status);
    if (!r.ok) { setError(r.error); return null; }
    const d = r.data!;
    setDirty(false);
    setRefCode(d.refCode);
    if (!id) { setId(d.id); router.replace(`/b/${biz}/internships/${d.id}`); }
    else router.refresh();
    return d;
  }

  function onSave() {
    start(async () => { const d = await save(); if (d) setToast(`Saved · ${formatRef(d.refCode)}`); });
  }

  function download(kind: DocKind) {
    // Open the tab now, inside the click, so pop-up blockers allow it; point it
    // at the PDF page once the latest changes are saved.
    const w = window.open("", "_blank");
    start(async () => {
      let target = id || null;
      if (canEdit && (dirty || !target)) target = (await save())?.id ?? null;
      if (!target) { w?.close(); return; }
      const url = `/print/internship/${target}?doc=${kind}&auto=1`;
      if (w) w.location.href = url; else window.location.href = url;
    });
  }

  const missing = [!p.fields.internName.trim() && "intern name", !p.fields.role.trim() && "role"].filter(Boolean) as string[];

  return (
    <div className="editor">
      <div className="stack">
        <div className="row between">
          <h2>{id ? p.fields.internName || "Internship" : "New internship"}</h2>
          <a className="btn sm" href={`/b/${biz}/internships`}>All internships</a>
        </div>
        <div className="numline">
          <div><div className="hint">Reference number</div><b>{refCode ? formatRef(refCode) : "LC/INT/YYMM/····"}</b></div>
          <div className="hint" style={{ maxWidth: 380 }}>
            {refCode
              ? `Never changes. Certificate number: LC/CERT/${refCode}.`
              : "Made when you first save: start month (YYMM) + 4 random characters, so it never shows how many interns you've had."}
          </div>
        </div>
        {!canEdit && <p className="notice">You can view and download these documents. Ask an editor to change them.</p>}

        <section className="card">
          <h3>Status</h3>
          <div className="grid">
            <label className="f"><span>Internship status</span>
              <select value={status} disabled={!canEdit} onChange={(e) => { setStatus(e.target.value as InternshipStatus); setDirty(true); }}>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </label>
          </div>
          <p className="hint" style={{ marginBottom: 0 }}>Every switch below says whether that detail appears on the documents. Hidden details stay saved, so you can bring them back any time.</p>
        </section>

        {GROUPS.map((g) => (
          <section className="card" key={g.id}>
            <h3>{g.label}</h3>
            {g.note && <p className="hint" style={{ marginTop: -4 }}>{g.note}</p>}
            <div className="grid ix-grid">
              {FIELDS.filter((f) => f.group === g.id).map((f) => (
                <FieldRow key={f.key} f={f} value={p.fields[f.key] ?? ""} shown={p.show[f.key] !== false} disabled={!canEdit} onValue={(v) => setField(f.key, v)} onShow={(on) => setShow(f.key, on)} />
              ))}
            </div>
          </section>
        ))}

        <section className="card">
          <div className="row between" style={{ marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Agreement terms</h3>
            {canEdit && <div className="row">
              <button type="button" className="btn sm" onClick={() => touch((x) => ({ ...x, terms: [...x.terms, { id: `custom-${Date.now()}`, title: "", text: "", show: true }] }))}>Add term</button>
              <button type="button" className="btn sm" onClick={() => { if (confirm("Replace all terms with the standard LoudCousin terms?")) touch((x) => ({ ...x, terms: DEFAULT_TERMS.map((t) => ({ ...t })) })); }}>Reset to standard</button>
            </div>}
          </div>
          <p className="hint">Hidden terms are left out and the rest renumber. {"{{responsibilities}}"}, {"{{jurisdiction}}"} and {"{{instagram}}"} are filled in from the fields above.</p>
          <div className="items">
            {p.terms.map((t, i) => (
              <div className={"item ix-term" + (t.show ? "" : " ix-off")} key={t.id}>
                <div className="ix-termhead">
                  <label className="ix-switch"><input type="checkbox" checked={t.show} disabled={!canEdit} onChange={(e) => setTerm(i, { show: e.target.checked })} /><span>{t.show ? "Shown" : "Hidden"}</span></label>
                  <input className="ix-termtitle" value={t.title} disabled={!canEdit} placeholder="Term title" onChange={(e) => setTerm(i, { title: e.target.value })} aria-label={`Term ${i + 1} title`} />
                  {canEdit && <div className="row" style={{ gap: 4 }}>
                    <button type="button" className="btn sm" aria-label="Move up" disabled={i === 0} onClick={() => moveTerm(i, -1)}>↑</button>
                    <button type="button" className="btn sm" aria-label="Move down" disabled={i === p.terms.length - 1} onClick={() => moveTerm(i, 1)}>↓</button>
                    <button type="button" className="btn sm danger" aria-label="Delete term" onClick={() => touch((x) => ({ ...x, terms: x.terms.filter((_, j) => j !== i) }))}>✕</button>
                  </div>}
                </div>
                <textarea value={t.text} disabled={!canEdit} onChange={(e) => setTerm(i, { text: e.target.value })} aria-label={`Term ${i + 1} text`} />
              </div>
            ))}
          </div>
        </section>

        {error && <p className="notice bad">{error}</p>}
        <div className="actions">
          {canEdit && <button type="button" className="btn primary" disabled={saving} onClick={onSave}>{saving ? "Saving…" : id ? "Save changes" : "Save internship"}</button>}
          {DOWNLOADS.map((k) => (
            <button type="button" key={k} className="btn" disabled={saving || (!id && !canEdit)} onClick={() => download(k)}>⤓ {DOC_LABEL[k]}</button>
          ))}
          {missing.length > 0 && <span className="hint bad">Still needed: {missing.join(", ")}</span>}
          {dirty && !missing.length && <span className="hint">Unsaved changes</span>}
        </div>
      </div>

      <div className="preview-col">
        <div className="nav ix-tabs" role="tablist" aria-label="Preview">
          {PREVIEWS.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={view === k} aria-current={view === k ? "page" : undefined} onClick={() => setView(k)}>{DOC_LABEL[k]}</button>
          ))}
        </div>
        <SheetPreview html={html} label={<><span>Live preview</span><span>Downloads save first, then open the PDF page</span></>} />
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function FieldRow({ f, value, shown, disabled, onValue, onShow }: { f: FieldDef; value: string; shown: boolean; disabled: boolean; onValue: (v: string) => void; onShow: (on: boolean) => void }) {
  const tags = f.docs.map((d) => DOC_TAG[d]).join(" · ");
  if (f.kind === "flag") {
    return (
      <div className={"ix-field ix-flag" + (shown ? "" : " ix-off")}>
        <label className="ix-switch"><input type="checkbox" checked={shown} disabled={disabled} onChange={(e) => onShow(e.target.checked)} /><span>{f.label}</span></label>
        <span className="hint">{f.hint || tags}</span>
      </div>
    );
  }
  const wide = f.kind === "textarea";
  const id = `ix-${f.key}`;
  return (
    <div className={"ix-field" + (wide ? " wide" : "") + (shown ? "" : " ix-off")}>
      <div className="ix-fieldhead">
        <label htmlFor={id}>{f.label}</label>
        {f.toggle === false
          ? <span className="hint">Always shown</span>
          : <label className="ix-switch ix-mini"><input type="checkbox" checked={shown} disabled={disabled} onChange={(e) => onShow(e.target.checked)} /><span>{shown ? "Show" : "Hidden"}</span></label>}
      </div>
      {f.kind === "textarea" ? (
        <textarea id={id} value={value} disabled={disabled} placeholder={f.placeholder} onChange={(e) => onValue(e.target.value)} />
      ) : f.kind === "select" ? (
        <select id={id} value={value} disabled={disabled} onChange={(e) => onValue(e.target.value)}>{f.options!.map((o) => <option key={o}>{o}</option>)}</select>
      ) : (
        <input id={id} type={f.kind === "date" ? "date" : "text"} value={value} disabled={disabled} placeholder={f.placeholder} onChange={(e) => onValue(e.target.value)} />
      )}
      <span className="hint">{f.hint ? `${f.hint} · ${tags}` : tags}</span>
    </div>
  );
}
