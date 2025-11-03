import { auth } from "@/auth";

// Require sign-in for protected pages. Role checks stay in routes/pages.
export default auth((req) => {
  if (!req.auth) {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("from", req.nextUrl.pathname);
    return Response.redirect(url);
  }
});

// Only match the *pages* that should require login.
// (Don’t include /api/*; those already do their own auth/role checks.)
export const config = {
  matcher: [
    "/orders",
    "/gym-admin",
    "/gym-admin/:path*",
    "/butcher",
    "/butcher/:path*",
    "/admin/:path*",
  ],
};
