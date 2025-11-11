import { auth } from "@/auth";
import { isSiteAdminEmail } from "@/lib/roles";
import { redirect } from "next/navigation";

import AdminButchersClient from "./AdminButchersClient";

export const dynamic = "force-dynamic";

export default async function AdminButchersPage() {
  const session = await auth();
  const email = session?.user?.email;

  if (!email || !isSiteAdminEmail(email)) {
    // You can redirect to / if you prefer
    redirect("/"); // or: notFound()
  }

  return <AdminButchersClient />;
}
