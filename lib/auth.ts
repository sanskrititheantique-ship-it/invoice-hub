import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";

export type Role = "viewer" | "editor" | "admin";
export type User = { id: number; email: string; name: string; access: Record<string, Role> };
export const SESSION_COOKIE = "ih_session";
const RANK: Record<Role, number> = { viewer: 1, editor: 2, admin: 3 };

export function authSecret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set to at least 32 random characters.");
  return new TextEncoder().encode(s);
}

export async function createSession(userId: number) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(authSecret());
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Reads the user from the database on every request, so access changes apply immediately. */
export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, authSecret());
    const [u] = await db()<User[]>`select id, email, name, access from users where id = ${Number(payload.uid)}`;
    return u || null;
  } catch {
    return null;
  }
}

export function roleOf(user: User | null, biz: string): Role | null {
  if (!user) return null;
  return (user.access["*"] as Role) || (user.access[biz] as Role) || null;
}
export const can = (user: User | null, biz: string, min: Role) => {
  const r = roleOf(user, biz);
  return !!r && RANK[r] >= RANK[min];
};

export async function requireUser() {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}
export async function requireAccess(biz: string, min: Role = "viewer") {
  const u = await requireUser();
  if (!can(u, biz, min)) redirect("/?denied=" + encodeURIComponent(biz));
  return u;
}
