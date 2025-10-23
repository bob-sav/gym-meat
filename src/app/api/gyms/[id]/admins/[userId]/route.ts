import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";

const prisma = new PrismaClient();

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: gymId, userId } = await ctx.params;

  await prisma.gymAdmin.deleteMany({ where: { gymId, userId } });
  return new NextResponse(null, { status: 204 });
}
