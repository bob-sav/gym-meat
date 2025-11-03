// src/app/api/me/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserRoles } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email ?? null;
  const roles = await getUserRoles(email);
  return NextResponse.json({
    ok: true,
    user: {
      name: session?.user?.name ?? null,
      email,
      roles,
    },
  });
}
