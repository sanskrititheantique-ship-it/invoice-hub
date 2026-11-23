// Everything an internship letter can contain, in one place.
//
// The editor, the API's validation and the printed documents all read this
// registry, so adding a field here is the whole job: it appears in the form
// with a Show/Hide switch, the server accepts it, and every old record picks
// up its default the next time it's opened (see normaliseInternship).
//
// Client-safe: no database or Node imports. Used by the editor in the
// browser, by lib/internships.ts on the server and by lib/internship-sheets.ts.

export type DocId = "offer" | "agreement" | "certificate";
export type FieldKind = "text" | "textarea" | "date" | "select" | "flag";

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  group: GroupId;
  docs: DocId[];
  placeholder?: string;
  hint?: string;
  options?: string[];
  /** Starting value for a new record. */
  default?: string;
  /** false = the field has no Show/Hide switch (it's always shown). */
  toggle?: boolean;
  /** Starting state of the Show/Hide switch. Defaults to shown. */
  defaultShow?: boolean;
}

export type GroupId = "intern" | "internship" | "offer" | "agreement" | "certificate" | "company";

export const GROUPS: { id: GroupId; label: string; note?: string }[] = [
  { id: "intern", label: "Intern" },
  { id: "internship", label: "Internship details" },
  { id: "offer", label: "Offer letter" },
  { id: "agreement", label: "Agreement", note: "The terms themselves are edited further down." },
  { id: "certificate", label: "Completion certificate" },
  { id: "company", label: "LoudCousin & signatory", note: "Same on every letter. Change only if your details change." },
];

export const FIELDS: FieldDef[] = [
  // ---- intern ----
  { key: "internName", label: "Full name", kind: "text", group: "intern", docs: ["offer", "agreement", "certificate"], placeholder: "Rahul Kumar", toggle: false },
  { key: "salutation", label: "Name in “Dear …”", kind: "text", group: "intern", docs: ["offer"], placeholder: "Rahul", hint: "Usually the first name." },
  { key: "course", label: "Course", kind: "text", group: "intern", docs: ["offer", "agreement"], placeholder: "B.Tech" },
  { key: "year", label: "Year", kind: "text", group: "intern", docs: ["offer", "agreement"], placeholder: "3rd Year" },
  { key: "college", label: "College / University", kind: "text", group: "intern", docs: ["offer", "agreement"], placeholder: "Newton School of Technology, Rishihood University" },
  { key: "rollNo", label: "Roll / enrolment no.", kind: "text", group: "intern", docs: ["agreement"], defaultShow: false },
  { key: "city", label: "City, State", kind: "text", group: "intern", docs: ["offer", "agreement"], placeholder: "Sonipat, Haryana" },
  { key: "address", label: "Full address", kind: "text", group: "intern", docs: ["offer", "agreement"], placeholder: "House no., street, PIN", defaultShow: false },
  { key: "email", label: "Email", kind: "text", group: "intern", docs: ["offer"] },
  { key: "phone", label: "Phone", kind: "text", group: "intern", docs: ["offer"] },

  // ---- internship ----
  { key: "role", label: "Role / designation", kind: "text", group: "internship", docs: ["offer", "agreement", "certificate"], placeholder: "Founder’s Office Intern (Tech & Operations)", toggle: false },
  { key: "startDate", label: "Start date", kind: "date", group: "internship", docs: ["offer", "agreement", "certificate"] },
  { key: "endDate", label: "End date", kind: "text", group: "internship", docs: ["agreement"], placeholder: "Ongoing, until ended with notice", default: "Ongoing, until ended with notice" },
  { key: "duration", label: "Duration", kind: "text", group: "internship", docs: ["offer"], placeholder: "3 months / Ongoing", default: "Ongoing" },
  { key: "mode", label: "Mode", kind: "select", group: "internship", docs: ["offer", "agreement"], options: ["Hybrid", "Remote", "On-site"], default: "Hybrid" },
  { key: "hours", label: "Working days & hours", kind: "text", group: "internship", docs: ["agreement"], placeholder: "Mon–Fri, 4 hours/day", default: "Flexible, as agreed with the Founder" },
  { key: "reportsTo", label: "Reports to", kind: "text", group: "internship", docs: ["offer", "agreement"], default: "Deepanshu Tyagi (Founder)" },
  { key: "stipend", label: "Stipend", kind: "text", group: "internship", docs: ["offer", "agreement"], placeholder: "₹15,000 per month", hint: "Write “Unpaid” for an unpaid internship, or hide it." },
  { key: "stipendPaidOn", label: "Stipend paid", kind: "text", group: "internship", docs: ["agreement"], default: "Monthly, via UPI" },
  { key: "incentive", label: "Performance incentive", kind: "text", group: "internship", docs: ["agreement"], placeholder: "₹500 per converted lead", defaultShow: false },
  { key: "trialPeriod", label: "Trial period", kind: "text", group: "internship", docs: ["agreement"], default: "First 7 days" },
  { key: "noticePeriod", label: "Notice period", kind: "text", group: "internship", docs: ["agreement"], default: "7 days' written notice, either side" },
  { key: "leave", label: "Leave allowed", kind: "text", group: "internship", docs: ["agreement"], default: "As agreed with the Founder, with prior notice" },

  // ---- offer letter ----
  { key: "letterDate", label: "Date on the letter", kind: "date", group: "offer", docs: ["offer", "agreement"] },
  { key: "refNo", label: "Reference number", kind: "flag", group: "offer", docs: ["offer", "agreement"], hint: "Made automatically when you first save. Never changes." },
  { key: "whyUs", label: "Why we picked them", kind: "textarea", group: "offer", docs: ["offer"], default: "We liked your skills and your energy, and we think you'll fit right in with how we work: fun on top, serious work underneath." },
  { key: "roleSummary", label: "What they'll own", kind: "textarea", group: "offer", docs: ["offer"], placeholder: "You'll own our website and tech, coordinate with clients and the team, and handle documentation." },
  { key: "detailsLine", label: "Details line", kind: "textarea", group: "offer", docs: ["offer"], default: "Your key details are below, and the full terms are in the attached Internship Agreement." },
  { key: "acceptanceDeadline", label: "Sign & return by", kind: "date", group: "offer", docs: ["offer"], defaultShow: false, hint: "Adds “Please sign both and return them by …”." },
  { key: "closingLine", label: "Closing line", kind: "text", group: "offer", docs: ["offer"], default: "Welcome to the loud side." },
  { key: "offerBoxes", label: "Key-details boxes", kind: "flag", group: "offer", docs: ["offer"] },
  { key: "flower", label: "Flower doodle", kind: "flag", group: "offer", docs: ["offer"] },
  { key: "digitalSignBox", label: "Digital signature box", kind: "flag", group: "offer", docs: ["offer", "certificate"] },

  // ---- agreement ----
  { key: "responsibilities", label: "Responsibilities (used in term 2)", kind: "textarea", group: "agreement", docs: ["agreement"], default: "Creating content for client pages, writing captions and DM scripts, helping with website builds, client outreach and event support" },
  { key: "declaration", label: "Intern declaration", kind: "flag", group: "agreement", docs: ["agreement"] },
  { key: "guardianSection", label: "Parent / guardian consent (under 18)", kind: "flag", group: "agreement", docs: ["agreement"], defaultShow: false },
  { key: "initials", label: "Initials line in footer", kind: "flag", group: "agreement", docs: ["agreement"] },

  // ---- certificate ----
  { key: "certIssueDate", label: "Issue date", kind: "date", group: "certificate", docs: ["certificate"] },
  { key: "certEndDate", label: "Internship ended on", kind: "date", group: "certificate", docs: ["certificate"] },
  { key: "pronoun", label: "Pronoun", kind: "select", group: "certificate", docs: ["certificate"], options: ["they", "he", "she"], default: "they", toggle: false },
  { key: "contributions", label: "Key contributions", kind: "textarea", group: "certificate", docs: ["certificate"], placeholder: "rebuilding loudcousin.com and running client documentation" },
  { key: "qualities", label: "Qualities", kind: "text", group: "certificate", docs: ["certificate"], default: "sincere, creative and genuinely loud" },
  { key: "certNo", label: "Certificate number", kind: "flag", group: "certificate", docs: ["certificate"] },
  { key: "verifyLine", label: "“Verify at …” line", kind: "flag", group: "certificate", docs: ["certificate"] },
  { key: "flowers", label: "Flower doodles", kind: "flag", group: "certificate", docs: ["certificate"] },

  // ---- company ----
  { key: "signatoryName", label: "Signatory name", kind: "text", group: "company", docs: ["offer", "agreement", "certificate"], default: "Deepanshu Tyagi", toggle: false },
  { key: "signatoryTitle", label: "Signatory title", kind: "text", group: "company", docs: ["offer", "agreement", "certificate"], default: "Founder / Business Coach" },
  { key: "entity", label: "Registered entity", kind: "text", group: "company", docs: ["offer", "agreement"], default: "Deepanshu Empire" },
  { key: "entityType", label: "Entity type", kind: "text", group: "company", docs: ["agreement"], default: "GST-registered proprietorship" },
  { key: "businessAddress", label: "Business address", kind: "text", group: "company", docs: ["offer", "agreement"], default: "Rohta Road, Meerut, Uttar Pradesh 250502" },
  { key: "gstin", label: "GSTIN", kind: "text", group: "company", docs: ["offer", "agreement"], default: "09HXMPD1277C1ZF" },
  { key: "udyam", label: "Udyam no.", kind: "text", group: "company", docs: ["offer", "agreement"], default: "UDYAM-UP-56-0160922" },
  { key: "contactEmail", label: "Email", kind: "text", group: "company", docs: ["offer", "agreement", "certificate"], default: "team@loudcousin.com" },
  { key: "website", label: "Website", kind: "text", group: "company", docs: ["offer", "agreement"], default: "loudcousin.com" },
  { key: "instagram", label: "Instagram", kind: "text", group: "company", docs: ["offer", "agreement"], default: "@theloudcousin" },
  { key: "jurisdiction", label: "Courts for disputes (term 13)", kind: "text", group: "company", docs: ["agreement"], default: "Meerut, Uttar Pradesh" },
];

export const FIELD_BY_KEY: Record<string, FieldDef> = Object.fromEntries(FIELDS.map((f) => [f.key, f]));

export interface Term {
  id: string;
  title: string;
  text: string;
  show: boolean;
}

// {{responsibilities}}, {{jurisdiction}} and {{instagram}} are filled in
// from the fields above when the agreement is drawn.
export const DEFAULT_TERMS: Term[] = [
  { id: "nature", title: "Nature of internship", text: "This is a training internship, not an offer of employment. It doesn't promise a full-time job. Any future role will be offered separately, in writing.", show: true },
  { id: "responsibilities", title: "Responsibilities", text: "{{responsibilities}}, plus other reasonable tasks linked to the role.", show: true },
  { id: "stipend", title: "Stipend", text: "Paid as stated above, only for days actually worked. Any tax that applies is deducted as per law.", show: true },
  { id: "attendance", title: "Attendance & leave", text: "Be available in agreed hours and reachable on WhatsApp / email. Unapproved absence of more than 3 days in a row may lead to termination.", show: true },
  { id: "confidentiality", title: "Confidentiality", text: "Never share LoudCousin’s or its clients’ confidential information: client names and data, pricing, strategies, logins, unreleased content, leads or internal files. This duty continues after the internship ends.", show: true },
  { id: "accounts", title: "Client accounts", text: "Access to client social media, websites, ad accounts or tools is only for assigned work. No password changes or posting without approval. All access is removed on the last day.", show: true },
  { id: "ip", title: "Ownership of work", text: "All designs, reels, copy, code, songs and ideas made during the internship belong to LoudCousin. You may show live work in your portfolio, credited “made at LoudCousin”, without client data.", show: true },
  { id: "conduct", title: "Conduct", text: "Represent LoudCousin with respect online and offline, at fests, meetings and events. Harassment, discrimination, account misuse or plagiarism means immediate termination.", show: true },
  { id: "social", title: "Social media", text: "Don’t post about clients or internal work without approval. You’re welcome to say you intern here and tag {{instagram}}.", show: true },
  { id: "equipment", title: "Equipment", text: "You use your own laptop and phone unless LoudCousin provides them. Anything provided is returned in good condition.", show: true },
  { id: "termination", title: "Termination", text: "Either side may end the internship with the notice period above. LoudCousin may end it immediately for misconduct, breach of confidentiality or repeated non-performance. Stipend is paid up to the last working day.", show: true },
  { id: "certificate", title: "Certificate", text: "An Internship Certificate is issued on successful completion. It isn’t issued if the internship is ended for misconduct or abandoned without notice.", show: true },
  { id: "law", title: "Governing law", text: "Laws of India apply. Disputes fall under the courts at {{jurisdiction}}.", show: true },
  { id: "entire", title: "Entire agreement", text: "This agreement and the offer letter are the full agreement between both sides. Any change must be in writing and signed by both. Electronic signatures are valid under the Information Technology Act, 2000.", show: true },
];

export type InternshipStatus = "draft" | "active" | "completed" | "ended";
export const STATUSES: InternshipStatus[] = ["draft", "active", "completed", "ended"];

export interface InternshipPayload {
  fields: Record<string, string>;
  show: Record<string, boolean>;
  terms: Term[];
}

export interface Internship {
  id: string;
  /** "2607/SW62" — see formatRef. Empty until the first save. */
  refCode: string;
  status: InternshipStatus;
  payload: InternshipPayload;
  createdAt: string;
  updatedAt: string;
}

export const MAX_TEXT = 4000;
export const MAX_TERMS = 40;

export function defaultPayload(today = todayIso()): InternshipPayload {
  const fields: Record<string, string> = {};
  const show: Record<string, boolean> = {};
  for (const f of FIELDS) {
    if (f.kind !== "flag") fields[f.key] = f.default ?? "";
    show[f.key] = f.defaultShow ?? true;
  }
  fields.letterDate = today;
  fields.certIssueDate = today;
  return { fields, show, terms: DEFAULT_TERMS.map((t) => ({ ...t })) };
}

/** Merge anything stored (or sent by the browser) over the defaults, keeping
 *  only known keys. Old records gain new fields; unknown keys are dropped. */
export function normaliseInternship(raw: unknown): InternshipPayload {
  const base = defaultPayload("");
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rf = obj.fields && typeof obj.fields === "object" ? (obj.fields as Record<string, unknown>) : {};
  const rs = obj.show && typeof obj.show === "object" ? (obj.show as Record<string, unknown>) : {};

  for (const f of FIELDS) {
    if (f.kind !== "flag" && typeof rf[f.key] === "string") {
      let v = (rf[f.key] as string).slice(0, MAX_TEXT);
      if (f.kind === "select" && f.options && !f.options.includes(v)) v = f.default ?? f.options[0];
      if (f.kind === "date" && v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) v = "";
      base.fields[f.key] = v;
    }
    if (f.toggle === false) base.show[f.key] = true;
    else if (typeof rs[f.key] === "boolean") base.show[f.key] = rs[f.key] as boolean;
  }

  if (Array.isArray(obj.terms)) {
    const terms: Term[] = [];
    const seen = new Set<string>();
    for (const t of obj.terms.slice(0, MAX_TERMS)) {
      if (!t || typeof t !== "object") continue;
      const r = t as Record<string, unknown>;
      let id = typeof r.id === "string" && r.id ? r.id.slice(0, 60) : `term-${terms.length + 1}`;
      while (seen.has(id)) id = `${id}-x`;
      seen.add(id);
      terms.push({
        id,
        title: typeof r.title === "string" ? r.title.slice(0, 200) : "",
        text: typeof r.text === "string" ? r.text.slice(0, MAX_TEXT) : "",
        show: r.show !== false,
      });
    }
    base.terms = terms;
  }
  return base;
}

// ---------- reference numbers ----------

/** Letters without I, L, O and digits without 0, 1 — nothing to misread. */
export const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const formatRef = (refCode: string) => (refCode ? `LC/INT/${refCode}` : "");
export const formatCertRef = (refCode: string) => (refCode ? `LC/CERT/${refCode}` : "");
export const refFileStem = (refCode: string) => (refCode ? `LC-INT-${refCode.replace("/", "-")}` : "LC-INT-DRAFT");

// ---------- dates ----------

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function todayIso() {
  // Indian time — the business runs on it, and a letter written at 1am IST
  // shouldn't carry yesterday's UTC date.
  const d = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

export function formatDate(iso: string, short = false) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!m) return iso || "";
  const month = MONTHS[Number(m[2]) - 1] ?? "";
  return `${Number(m[3])} ${short ? month.slice(0, 3) : month} ${m[1]}`;
}

/** "2026-07-10" → "2607". */
export function yymmFrom(iso: string) {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(iso || "");
  if (m) return `${m[1].slice(2)}${m[2]}`;
  return todayIso().slice(2, 7).replace("-", "");
}

export function fileName(internName: string, refCode: string, doc: string) {
  const person = (internName || "Intern").trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${refFileStem(refCode)}_${doc}_${person}`;
}
