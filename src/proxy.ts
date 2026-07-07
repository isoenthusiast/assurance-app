import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

export default auth(function proxy(req) {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname === "/login";

  // Redirect unauthenticated users to login (except login page itself)
  if (!isLoggedIn && !isLoginPage) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from login page
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  // Fix forwarded host for Codespaces proxy — Next.js Server Actions
  // validate the Host header matches the browser's origin, but Codespaces
  // forwards requests with Host=localhost:3000. Override the Host header
  // to match the external URL so Server Actions don't get rejected.
  const forwardedHost = req.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("host", forwardedHost);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
