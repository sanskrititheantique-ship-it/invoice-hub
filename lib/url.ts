import "server-only";
import { headers } from "next/headers";

/** Public base URL for share links. Set APP_URL in Vercel to your custom domain. */
export async function appUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") || "https"}://${h.get("host")}`;
}
