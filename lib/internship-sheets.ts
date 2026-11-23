// The three internship documents, as HTML strings — the same approach as
// lib/sheets.ts, so the editor preview (SheetPreview) and the print page show
// exactly the same markup. Styles live in app/internships.css (.lcx-*).
//
// Every field obeys its Show/Hide switch: a hidden or empty field leaves no
// gap, label or stray punctuation behind.

import {
  InternshipPayload,
  formatCertRef,
  formatDate,
  formatRef,
} from "./internship-fields";

export type DocKind = "offer" | "agreement" | "both" | "certificate";
export const DOC_LABEL: Record<DocKind, string> = {
  offer: "Offer letter",
  agreement: "Internship agreement",
  both: "Offer letter + agreement",
  certificate: "Completion certificate",
};
export const DOC_FILE: Record<DocKind, string> = {
  offer: "Offer-Letter",
  agreement: "Internship-Agreement",
  both: "Offer-and-Agreement",
  certificate: "Internship-Certificate",
};

const esc = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

type Ctx = {
  p: InternshipPayload;
  refCode: string;
  /** true in the editor: shows "[Name]"-style hints for required blanks. */
  draft?: boolean;
};

function helpers({ p, draft }: Ctx) {
  const on = (k: string) => p.show[k] !== false;
  const v = (k: string) => (p.fields[k] ?? "").trim();
  const has = (k: string) => on(k) && !!v(k);
  /** Required text: shows a dim placeholder in the editor rather than nothing. */
  const req = (k: string, label: string) => (v(k) ? esc(v(k)) : draft ? `<span class="lcx-blank">[${esc(label)}]</span>` : "");
  const date = (k: string, short = false) => esc(formatDate(v(k), short));
  return { on, v, has, req, date };
}

const LOGO = (bg: string) =>
  `<svg class="lcx-logo" viewBox="0 0 100 100" aria-hidden="true"><rect width="100" height="100" rx="22" fill="${bg}"/><circle cx="50" cy="50" r="33" fill="#D4FF5A"/><path d="M50 25 C52 45 55 48 75 50 C55 52 52 55 50 75 C48 55 45 52 25 50 C45 48 48 45 50 25 Z" fill="#0E0E0E"/></svg>`;

function flower(petal: string, centre: string, cls: string) {
  const petals = [0, 45, 90, 135, 180, 225, 270, 315]
    .map((r) => `<ellipse cx="50" cy="24" rx="11" ry="21" fill="${petal}" stroke="#0E0E0E" stroke-width="3" transform="rotate(${r} 50 50)"/>`)
    .join("");
  return `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true">${petals}<circle cx="50" cy="50" r="17" fill="${centre}" stroke="#0E0E0E" stroke-width="3"/></svg>`;
}

function letterhead(c: Ctx) {
  const { has, v } = helpers(c);
  const line2 = [has("website") ? esc(v("website")) : "", has("instagram") ? esc(v("instagram")) : ""].filter(Boolean).join(" · ");
  return `<div class="lcx-head">
    <div class="lcx-head-in">
      <div class="lcx-mark">${LOGO("#1B1B1B")}<div><div class="lcx-word">loud<span>cousin</span></div><div class="lcx-tag">WE MAKE BRANDS LOUD</div></div></div>
      <div class="lcx-contact">${has("contactEmail") ? `<div>${esc(v("contactEmail"))}</div>` : ""}${line2 ? `<div>${line2}</div>` : ""}</div>
    </div>
    <div class="lcx-pink"></div>
    <div class="lcx-headgap"></div>
  </div>`;
}

function legalLine(c: Ctx) {
  const { has, v } = helpers(c);
  return [
    has("entity") ? `LoudCousin is a brand of ${esc(v("entity"))}` : "",
    has("gstin") ? `GSTIN ${esc(v("gstin"))}` : "",
    has("udyam") ? `Udyam ${esc(v("udyam"))}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** A sheet whose header and footer repeat on every printed page. */
function flowSheet(head: string, body: string, foot: string) {
  return `<div class="lcx lcx-a4"><table class="lcx-flow">
    <thead><tr><td>${head}</td></tr></thead>
    <tfoot><tr><td>${foot}</td></tr></tfoot>
    <tbody><tr><td class="lcx-body">${body}</td></tr></tbody>
  </table></div>`;
}

function signBox(label = "DIGITAL SIGNATURE") {
  return `<div class="lcx-esign"><div class="lcx-label">${label}</div><div class="lcx-esign-lines">Signed by: ________________________<br>Date &amp; time: _____________________<br>E-sign ID: ________________________</div></div>`;
}

// ---------------------------------------------------------------- offer

export function offerHTML(c: Ctx) {
  const { has, v, req, date, on } = helpers(c);
  const ref = c.refCode ? formatRef(c.refCode) : c.draft ? "Assigned on first save" : "";

  const toLines = [
    `<div class="lcx-strong">${req("internName", "Intern name")}</div>`,
    [has("course") ? esc(v("course")) : "", has("year") ? esc(v("year")) : ""].filter(Boolean).join(", "),
    has("college") ? esc(v("college")) : "",
    has("address") ? esc(v("address")) : "",
    has("city") ? esc(v("city")) : "",
    [has("email") ? esc(v("email")) : "", has("phone") ? esc(v("phone")) : ""].filter(Boolean).join(" · "),
  ].filter(Boolean);

  const meta = [
    on("refNo") && ref ? `<div class="lcx-label">REF. NO.</div><div class="lcx-metav">${esc(ref)}</div>` : "",
    has("letterDate") ? `<div class="lcx-label">DATE</div><div class="lcx-metav">${date("letterDate")}</div>` : "",
  ].join("");

  const role = req("role", "Role");
  const p1 = `We're happy to offer you an internship at <strong>LoudCousin</strong> as <strong>${role}</strong>.${has("whyUs") ? " " + esc(v("whyUs")) : ""}`;
  const p2 = [
    has("roleSummary") ? esc(v("roleSummary")) : "",
    has("detailsLine") ? esc(v("detailsLine")) : "",
    has("acceptanceDeadline") ? `Please sign both and return them by <strong>${date("acceptanceDeadline")}</strong>.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const boxes = [
    ["ROLE", v("role") ? esc(v("role")) : ""],
    ["START DATE", has("startDate") ? date("startDate", true) : ""],
    ["DURATION", has("duration") ? esc(v("duration")) : ""],
    ["MODE", has("mode") ? esc(v("mode")) : ""],
    ["STIPEND", has("stipend") ? esc(v("stipend")) : ""],
    ["REPORTS TO", has("reportsTo") ? esc(v("reportsTo")) : ""],
  ].filter(([, x]) => x);

  const body = `
    ${on("flower") ? flower("#FF4FA3", "#D4FF5A", "lcx-flower-tr") : ""}
    <div class="lcx-hero"><div class="lcx-anton lcx-h1">Internship</div><div class="lcx-slab lcx-h1">Offer Letter</div></div>
    <div class="lcx-to">
      <div><div class="lcx-label">TO</div>${toLines.map((l) => `<div>${l}</div>`).join("")}</div>
      ${meta ? `<div class="lcx-meta">${meta}</div>` : ""}
    </div>
    <div class="lcx-letter">
      <p class="lcx-strong">Subject: Offer of Internship — ${role}</p>
      ${has("salutation") || v("internName") ? `<p>Dear ${esc(v("salutation") && on("salutation") ? v("salutation") : v("internName"))},</p>` : ""}
      <p>${p1}</p>
      ${p2 ? `<p>${p2}</p>` : ""}
    </div>
    ${on("offerBoxes") && boxes.length ? `<div class="lcx-boxes">${boxes.map(([l, x]) => `<div class="lcx-box"><div class="lcx-label">${l}</div><div class="lcx-boxv">${x}</div></div>`).join("")}</div>` : ""}
    <div class="lcx-letter">${has("closingLine") ? `<p>${esc(v("closingLine"))}<br>Warm regards,</p>` : `<p>Warm regards,</p>`}</div>
    <div class="lcx-signrow">
      <div class="lcx-signer"><div class="lcx-signline"></div><div class="lcx-strong">${esc(v("signatoryName"))}</div><div class="lcx-small">${[has("signatoryTitle") ? esc(v("signatoryTitle")) + ", LoudCousin" : "LoudCousin", has("entity") ? "for " + esc(v("entity")) : ""].filter(Boolean).join(" · ")}</div></div>
      ${on("digitalSignBox") ? signBox() : ""}
    </div>`;

  const legal = legalLine(c);
  const foot = `<div class="lcx-foot"><div>${legal}</div></div>`;
  return flowSheet(letterhead(c), body, foot);
}

// ------------------------------------------------------------ agreement

export function agreementHTML(c: Ctx) {
  const { has, v, req, date, on } = helpers(c);
  const ref = c.refCode ? formatRef(c.refCode) : c.draft ? "Assigned on first save" : "";
  const name = req("internName", "Intern name");

  const internBits = [
    [has("course") ? esc(v("course")) : "", has("year") ? `(${esc(v("year"))})` : ""].filter(Boolean).join(" "),
    has("college") ? esc(v("college")) : "",
    has("address") ? esc(v("address")) : "",
    has("city") ? esc(v("city")) : "",
  ].filter(Boolean);
  const lcBits = [
    has("entity") ? `a brand of ${esc(v("entity"))}${has("entityType") ? ` (${esc(v("entityType"))})` : ""}` : "",
    has("businessAddress") ? esc(v("businessAddress")) : "",
    has("gstin") ? `GSTIN ${esc(v("gstin"))}` : "",
  ].filter(Boolean);

  const parties = `This agreement is made between <strong>LoudCousin</strong>${lcBits.length ? ", " + lcBits.join(", ") : ""}, represented by ${esc(v("signatoryName"))}${has("signatoryTitle") ? `, ${esc(v("signatoryTitle").split("/")[0].trim())}` : ""} (“LoudCousin”), and <strong>${name}</strong>${internBits.length ? ", " + internBits.join(", ") : ""} (“Intern”).`;

  const rows: [string, string][] = [
    ["Role / Designation", v("role") ? esc(v("role")) : ""],
    ["Mode", has("mode") ? esc(v("mode")) : ""],
    ["Start date", has("startDate") ? date("startDate") : ""],
    ["End date", has("endDate") ? esc(v("endDate")) : ""],
    ["Working days & hours", has("hours") ? esc(v("hours")) : ""],
    ["Reports to", has("reportsTo") ? esc(v("reportsTo")) : ""],
    ["Stipend", has("stipend") ? esc(v("stipend")) : ""],
    ["Stipend paid", has("stipendPaidOn") ? esc(v("stipendPaidOn")) : ""],
    ["Performance incentive", has("incentive") ? esc(v("incentive")) : ""],
    ["Trial period", has("trialPeriod") ? esc(v("trialPeriod")) : ""],
    ["Notice period", has("noticePeriod") ? esc(v("noticePeriod")) : ""],
    ["Leave allowed", has("leave") ? esc(v("leave")) : ""],
  ];
  const details = rows.filter(([, x]) => x);

  const fill = (t: string) =>
    esc(
      t
        .replace(/\{\{responsibilities\}\}/g, has("responsibilities") ? v("responsibilities") : "")
        .replace(/\{\{jurisdiction\}\}/g, v("jurisdiction") || "Meerut, Uttar Pradesh")
        .replace(/\{\{instagram\}\}/g, v("instagram") || "@theloudcousin"),
    ).replace(/^, /, "");
  const terms = c.p.terms.filter((t) => t.show && (t.title.trim() || t.text.trim()));

  let n = 0;
  const section = (label: string) => `<div class="lcx-section"><span class="lcx-num">${String(++n).padStart(2, "0")}</span>${label}</div>`;

  const card = (title: string, lines: string[]) =>
    `<div class="lcx-sigcard"><div class="lcx-label">${title}</div><div class="lcx-sigspace">Sign here (digital / e-sign)</div><div class="lcx-siglines">${lines.map((l) => `<div>${l}</div>`).join("")}</div></div>`;

  const body = `
    <div class="lcx-titlerow">
      <div class="lcx-titlel"><span class="lcx-anton lcx-h2">Internship</span><span class="lcx-slab lcx-h2">Agreement</span></div>
      <div class="lcx-meta-sm">${on("refNo") && ref ? `<div><strong>Ref:</strong> ${esc(ref)}</div>` : ""}${has("letterDate") ? `<div><strong>Date:</strong> ${date("letterDate")}</div>` : ""}</div>
    </div>
    <p class="lcx-para">${parties}</p>
    ${details.length ? `${section("INTERNSHIP DETAILS")}<div class="lcx-details">${details.map(([l, x]) => `<div class="lcx-cell"><div class="lcx-cl">${esc(l)}</div><div class="lcx-cv">${x}</div></div>`).join("")}</div>` : ""}
    ${terms.length ? `${section("TERMS &amp; CONDITIONS")}<div class="lcx-terms">${terms.map((t, i) => `<div class="lcx-term${i === terms.length - 1 && terms.length % 2 === 1 ? " lcx-span" : ""}"><strong>${i + 1}. ${esc(t.title)}${t.title && !/[.:]$/.test(t.title) ? "." : ""}</strong> ${fill(t.text)}</div>`).join("")}</div>` : ""}
    <div class="lcx-keep">
      ${section("ACCEPTANCE &amp; SIGNATURES")}
      ${on("declaration") ? `<div class="lcx-decl"><strong>Intern declaration:</strong> I, ${name}, have read and understood the offer letter and this agreement. I accept the internship and agree to follow these terms.</div>` : ""}
      <div class="lcx-sigs">
        ${card(`FOR LOUDCOUSIN${has("entity") ? ` (${esc(v("entity").toUpperCase())})` : ""}`, [
          `<strong>Name:</strong> ${esc(v("signatoryName"))}`,
          has("signatoryTitle") ? `<strong>Designation:</strong> ${esc(v("signatoryTitle"))}` : "",
          `<strong>Date:</strong> ____________ · <strong>Place:</strong> ____________`,
          `<span class="lcx-dim"><strong>E-sign ID / timestamp:</strong> ____________</span>`,
        ].filter(Boolean))}
        ${card("INTERN", [
          `<strong>Name:</strong> ${name}`,
          has("college") ? `<strong>College:</strong> ${esc(v("college"))}` : "",
          has("rollNo") ? `<strong>Roll no.:</strong> ${esc(v("rollNo"))}` : "",
          `<strong>Date:</strong> ____________ · <strong>Place:</strong> ____________`,
          `<span class="lcx-dim"><strong>E-sign ID / timestamp:</strong> ____________</span>`,
        ].filter(Boolean))}
      </div>
      ${on("guardianSection") ? `<div class="lcx-guardian"><strong>Parent / Guardian consent</strong> (the intern is under 18): I consent to my ward taking up this internship on these terms.<br>Signature: ______________ · Name: ______________ · Relation: __________ · Date: __________</div>` : ""}
    </div>`;

  const foot = `<div class="lcx-foot"><div>LoudCousin · Internship Agreement${on("refNo") && c.refCode ? ` · ${esc(formatRef(c.refCode))}` : ""}${has("udyam") ? ` · Udyam ${esc(v("udyam"))}` : ""}</div>${on("initials") ? `<div>Initials: LoudCousin ______ · Intern ______</div>` : ""}</div>`;
  return flowSheet(letterhead(c), body, foot);
}

// ----------------------------------------------------------- certificate

export function certificateHTML(c: Ctx) {
  const { has, v, req, date, on } = helpers(c);
  const cert = c.refCode ? formatCertRef(c.refCode) : c.draft ? "Assigned on first save" : "";
  const pronoun = v("pronoun") || "they";
  const end = has("certEndDate") ? date("certEndDate") : c.draft ? `<span class="lcx-blank">[End date]</span>` : "";
  const from = has("startDate") ? date("startDate") : "";

  let sentence = `for completing an internship at <strong>LoudCousin</strong> as <strong>${req("role", "Role")}</strong>`;
  if (from && end) sentence += ` from <strong>${from}</strong> to <strong>${end}</strong>`;
  else if (end) sentence += ` until <strong>${end}</strong>`;
  sentence += ".";
  const contrib = has("contributions") ? esc(v("contributions")) : "";
  const quals = has("qualities") ? esc(v("qualities")) : "";
  if (contrib && quals) sentence += ` During this time ${pronoun} worked on ${contrib}, and showed up ${quals}.`;
  else if (contrib) sentence += ` During this time ${pronoun} worked on ${contrib}.`;
  else if (quals) sentence += ` ${pronoun.charAt(0).toUpperCase() + pronoun.slice(1)} showed up ${quals}.`;

  const ticker = Array.from({ length: 7 }, () => "<span>LOUDCOUSIN</span>").join(`<span class="lcx-pinkstar">✦</span>`);

  return `<div class="lcx lcx-cert">
    <div class="lcx-ticker">${ticker}</div>
    <svg class="lcx-bigstar" viewBox="312 312 456 456" aria-hidden="true"><path d="M540 312 C562 492 588 518 768 540 C588 562 562 588 540 768 C518 588 492 562 312 540 C492 518 518 492 540 312 Z" fill="#0E0E0E"/></svg>
    ${on("flowers") ? flower("#FF4FA3", "#D4FF5A", "lcx-cflower1") + flower("#D4FF5A", "#FF8A1F", "lcx-cflower2") : ""}
    <div class="lcx-certframe">
      <div class="lcx-certtop">
        <div class="lcx-mark">${LOGO("#0E0E0E")}<div class="lcx-word lcx-word-ink">loudcousin</div></div>
        <div class="lcx-meta-sm">${on("certNo") && cert ? `<div><strong>Certificate No.:</strong> ${esc(cert)}</div>` : ""}${has("certIssueDate") ? `<div><strong>Issued on:</strong> ${date("certIssueDate")}</div>` : ""}</div>
      </div>
      <div class="lcx-certhead"><div class="lcx-anton lcx-h3">Certificate of</div><div class="lcx-slab lcx-h4">Internship</div></div>
      <div class="lcx-presented">This is proudly presented to</div>
      <div class="lcx-certname">${req("internName", "Intern name")}</div>
      <div class="lcx-underline"></div>
      <p class="lcx-certbody">${sentence}</p>
      <div class="lcx-certfoot">
        <div class="lcx-signer lcx-w270"><div class="lcx-signline"></div><div class="lcx-strong">${esc(v("signatoryName"))}</div><div class="lcx-small">${has("signatoryTitle") ? esc(v("signatoryTitle")) + ", " : ""}LoudCousin</div></div>
        ${on("digitalSignBox") ? signBox() : "<div></div>"}
        <div class="lcx-verify lcx-w270">${on("verifyLine") && has("contactEmail") ? `Verify at ${esc(v("contactEmail"))}<br>quoting the Certificate No.` : ""}</div>
      </div>
    </div>
  </div>`;
}

export function docHTML(kind: DocKind, c: Ctx) {
  if (kind === "offer") return offerHTML(c);
  if (kind === "agreement") return agreementHTML(c);
  if (kind === "certificate") return certificateHTML(c);
  return offerHTML(c) + agreementHTML(c);
}
