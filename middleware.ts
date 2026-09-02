import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifySessionCookie } from "@/lib/auth";

/**
 * Protects every /admin and /api/admin route except the login page.
 *
 * The Edge runtime can only verify the cookie's HMAC and expiry; whether the
 * session row still exists is re-checked in the Node runtime on every admin
 * request. The login page is deliberately never redirected from here: a cookie
 * whose session was revoked still has a valid signature, and bouncing it back
 * to /admin would loop forever. /admin/login makes that call itself, against
 * the database.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();

  const session = await verifySessionCookie(req.cookies.get(ADMIN_COOKIE)?.value);
  if (session) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const login = new URL("/admin/login", req.url);
  login.searchParams.set("next", pathname);
  const res = NextResponse.redirect(login);
  res.cookies.delete(ADMIN_COOKIE);
  return res;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
