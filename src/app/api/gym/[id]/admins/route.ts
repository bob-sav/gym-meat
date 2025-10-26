import { NextResponse, NextRequest } from "next/server";
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

  const { email } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const link = await prisma.gymAdmin.upsert({
    where: { gymId_userId: { gymId, userId: user.id } },
    create: { gymId, userId: user.id },
    update: {},
  });

  return NextResponse.json({ admin: link }, { status: 201 });
}
