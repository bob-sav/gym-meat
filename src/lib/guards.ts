// src/lib/guards.ts
import { auth } from "@/auth";
import { isSiteAdminEmail } from "@/lib/roles";
import { redirect } from "next/navigation";

// little guard for the admin pages - products/butcher/gym-admin
export async function requireSiteAdmin() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !isSiteAdminEmail(email)) redirect("/");
  return session; // if you need user info
}
