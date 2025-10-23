import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";

const prisma = new PrismaClient();

const addSchema = z.object({
  email: z.string().email(),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: gymId } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const u = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, email: true, name: true },
  });
  if (!u) {
    return NextResponse.json(
      { error: "User not found (they must sign up first)" },
      { status: 404 }
    );
  }

  const admin = await prisma.gymAdmin.upsert({
    where: { gymId_userId: { gymId, userId: u.id } },
    create: { gymId, userId: u.id },
    update: {},
  });

  return NextResponse.json({
    admin: { id: admin.id, userId: u.id, userEmail: u.email, userName: u.name },
  });
}
