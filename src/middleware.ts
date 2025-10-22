import { auth } from "@/auth";

// Gate any /admin/* path. If not signed-in, redirect to /login.
export default auth((req) => {
  if (!req.auth) {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("from", req.nextUrl.pathname);
    return Response.redirect(url);
  }
});

export const config = {
  matcher: ["/admin/:path*"],
};
