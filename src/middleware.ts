// src/middleware.ts
import { auth } from "@/auth";

export default auth((req) => {
  if (req.nextUrl.pathname.startsWith("/login")) return;

  if (!req.auth) {
    const from = req.nextUrl.pathname + req.nextUrl.search;
    const base =
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.NEXTAUTH_URL ??
      process.env.AUTH_URL ??
      req.nextUrl.origin;

    const loginUrl = new URL("/login", base);
    loginUrl.searchParams.set("from", from);
    return Response.redirect(loginUrl);
  }
});

// Only protect the pages you listed (no /api/*).
export const config = {
  matcher: [
    "/orders",
    "/gym-admin",
    "/gym-admin/:path*",
    "/butcher",
    "/butcher/:path*",
    "/admin/:path*",
    "/account", // if the settings page gated
  ],
};
