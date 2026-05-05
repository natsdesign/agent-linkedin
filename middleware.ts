import { NextRequest, NextResponse } from "next/server";

const BYPASS_PREFIXES = [
  "/locked",
  "/api/unlock",
  "/_next",
  "/favicon.ico",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (BYPASS_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get("app_access");
  if (cookie?.value && cookie.value === process.env.APP_SECRET) {
    return NextResponse.next();
  }

  const lockUrl = new URL("/locked", req.url);
  return NextResponse.redirect(lockUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
