import { NextResponse, NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { isSiteAdminEmail } from "@/lib/roles";

const prisma = new PrismaClient();

const addSchema = z.object({
  email: z.string().email(),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSiteAdminEmail(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  // Optional: ensure the gym exists (nicer error than a FK failure)
  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: { id: true },
  });
  if (!gym) {
    return NextResponse.json({ error: "Gym not found" }, { status: 404 });
  }

  const targetUser = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });
  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const link = await prisma.gymAdmin.upsert({
    where: { gymId_userId: { gymId, userId: targetUser.id } },
    create: { gymId, userId: targetUser.id },
    update: {},
  });

  return NextResponse.json({ admin: link }, { status: 201 });
}
