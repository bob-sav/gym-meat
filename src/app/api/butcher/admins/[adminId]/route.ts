import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";

const prisma = new PrismaClient();
const roleSchema = z.object({ role: z.enum(["PREP_ONLY", "SETTLEMENT"]) });

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ adminId: string }> }
) {
  const session = await auth();
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { adminId } = await ctx.params;
  const parse = roleSchema.safeParse(await req.json().catch(() => ({})));
  if (!parse.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parse.error.flatten() },
      { status: 400 }
    );
  }

  const updated = await prisma.butcherAdmin.update({
    where: { id: adminId },
    data: { role: parse.data.role as any },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  return NextResponse.json({
    admin: {
      id: updated.id,
      userId: updated.userId,
      role: updated.role,
      userEmail: updated.user?.email ?? null,
      userName: updated.user?.name ?? null,
      createdAt: updated.createdAt,
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ adminId: string }> }
) {
  const session = await auth();
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { adminId } = await ctx.params;
  await prisma.butcherAdmin.delete({ where: { id: adminId } });
  return new NextResponse(null, { status: 204 });
}
