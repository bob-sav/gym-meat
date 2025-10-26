import { NextResponse, NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";

const prisma = new PrismaClient();

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; adminId: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { adminId } = await ctx.params;

  // If it's already gone, treat as success (idempotent UX)
  try {
    await prisma.gymAdmin.delete({ where: { id: adminId } });
  } catch {
    // noop
  }
  return new NextResponse(null, { status: 204 });
}
