"use server";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Role, can, clearSession, createSession, currentUser } from "@/lib/auth";
import * as inv from "@/lib/invoices";
import type { Draft, Settings } from "@/lib/tax";

export type Result<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

async function guard<T>(biz: string, min: Role, fn: (actor: string) => Promise<T>): Promise<Result<T>> {
  const u = await currentUser();
  if (!u) return { ok: false, error: "Your session has ended. Sign in again." };
  if (!can(u, biz, min)) return { ok: false, error: min === "admin" ? "Only admins of this business can do that." : "You don't have permission to change this business." };
  try {
    const data = await fn(u.email);
    revalidatePath(`/b/${biz}`, "layout");
    return { ok: true, data };
  } catch (e) {
    if (e instanceof inv.UserError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Something went wrong while saving. Nothing was changed. Try again." };
  }
}

/* auth */
export async function loginAction(_: unknown, form: FormData): Promise<{ error?: string }> {
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const [u] = await db()<{ id: number; password_hash: string }[]>`select id, password_hash from users where lower(email) = ${email}`;
  if (!u || !(await bcrypt.compare(password, u.password_hash))) {
    await new Promise((r) => setTimeout(r, 600)); // slows down password guessing
    return { error: "That email and password don't match." };
  }
  await createSession(u.id);
  const next = String(form.get("next") || "/");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}
export async function logoutAction() {
  await clearSession();
  redirect("/login");
}
export async function changePasswordAction(_: unknown, form: FormData): Promise<{ error?: string; ok?: boolean }> {
  const u = await currentUser();
  if (!u) return { error: "Sign in again." };
  const cur = String(form.get("current") || ""), next = String(form.get("next") || "");
  if (next.length < 10) return { error: "Use at least 10 characters for the new password." };
  const [row] = await db()<{ password_hash: string }[]>`select password_hash from users where id = ${u.id}`;
  if (!(await bcrypt.compare(cur, row.password_hash))) return { error: "Your current password is wrong." };
  await db()`update users set password_hash = ${await bcrypt.hash(next, 12)} where id = ${u.id}`;
  return { ok: true };
}

/* invoices */
export async function createInvoiceAction(biz: string, draft: Draft) {
  return guard(biz, "editor", async (a) => { const r = await inv.createDoc({ biz, draft, actor: a }); return { id: r.row.id, number: r.row.number }; });
}
export async function createCreditNoteAction(biz: string, refId: string, draft: Draft) {
  return guard(biz, "editor", async (a) => { const r = await inv.createDoc({ biz, draft, actor: a, docType: "credit_note", refId }); return { id: r.row.id, number: r.row.number }; });
}
export async function updateInvoiceAction(biz: string, id: string, draft: Draft) {
  return guard(biz, "editor", async (a) => ({ id: await inv.updateDoc(biz, id, draft, a) }));
}
export async function cancelInvoiceAction(biz: string, id: string, reason: string) {
  return guard(biz, "editor", (a) => inv.cancelDoc(biz, id, reason, a));
}
export async function addPaymentAction(biz: string, id: string, p: { date: string; amount: number; mode: string; ref: string; note: string }) {
  return guard(biz, "editor", (a) => inv.addPayment(biz, id, p, a));
}
export async function deletePaymentAction(biz: string, paymentId: number) {
  return guard(biz, "editor", (a) => inv.deletePayment(biz, paymentId, a));
}
export async function shareAction(biz: string, id: string, on: boolean) {
  return guard(biz, "editor", (a) => inv.setShare(biz, id, on, a));
}

/* settings */
export async function saveSettingsAction(biz: string, data: Settings) {
  return guard(biz, "admin", (a) => inv.saveSettings(biz, data, a));
}
export async function saveCatalogAction(biz: string, items: inv.CatalogItem[]) {
  return guard(biz, "admin", (a) => inv.saveCatalog(biz, items, a));
}
export async function setNextNumberAction(biz: string, code: string, origin: string, next: number) {
  return guard(biz, "admin", (a) => inv.setNextNumber(biz, code, origin, next, a));
}
export async function createApiKeyAction(biz: string, name: string) {
  return guard(biz, "admin", (a) => inv.createApiKey(biz, name, a));
}
export async function revokeApiKeyAction(biz: string, id: number) {
  return guard(biz, "admin", (a) => inv.revokeApiKey(biz, id, a));
}
