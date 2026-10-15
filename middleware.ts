import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Everything needs a signed-in session except the login page, public invoice links and the website API.
export const config = { runtime: "nodejs", matcher: ["/((?!_next/|favicon.ico|login|i/|api/v1/).*)"] };

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("ih_session")?.value;
  if (token && process.env.AUTH_SECRET) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET));
      return NextResponse.next();
    } catch {}
  }
  if (req.nextUrl.pathname.startsWith("/api/")) return new NextResponse("Sign in required", { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "?next=" + encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}
