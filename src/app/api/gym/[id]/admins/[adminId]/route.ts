import { NextResponse, NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { isSiteAdminEmail } from "@/lib/roles";

const prisma = new PrismaClient();

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; adminId: string }> }
) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSiteAdminEmail(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: gymId, adminId } = await ctx.params;

  // Soft guard: only allow delete if this admin record belongs to the gym in the URL.
  // (Prisma delete uses a unique where, so we verify the gym first.)
  const row = await prisma.gymAdmin.findUnique({
    where: { id: adminId },
    select: { id: true, gymId: true },
  });

  // If the record exists and doesn't belong to this gym, respond 404 to avoid leaking IDs.
  if (row && row.gymId !== gymId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Idempotent delete: if it's already gone, still treat as success.
  try {
    await prisma.gymAdmin.delete({ where: { id: adminId } });
  } catch {
    // noop
  }

  return new NextResponse(null, { status: 204 });
}
