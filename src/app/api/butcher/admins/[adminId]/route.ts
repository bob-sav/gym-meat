// src/app/api/butcher/admins/[adminId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { isSiteAdminEmail } from "@/lib/roles";

const prisma = new PrismaClient();
const roleSchema = z.object({ role: z.enum(["PREP_ONLY", "SETTLEMENT"]) });

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ adminId: string }> }
) {
  const session = await auth();
  const actingEmail = session?.user?.email;
  if (!actingEmail || !isSiteAdminEmail(actingEmail)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { adminId } = await ctx.params;

  const parse = roleSchema.safeParse(await req.json().catch(() => ({})));
  if (!parse.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parse.error.flatten() },
      { status: 400 }
    );
  }

  try {
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
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ adminId: string }> }
) {
  const session = await auth();
  const actingEmail = session?.user?.email;
  if (!actingEmail || !isSiteAdminEmail(actingEmail)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { adminId } = await ctx.params;

  try {
    await prisma.butcherAdmin.delete({ where: { id: adminId } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
