import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";

const prisma = new PrismaClient();

const createSchema = z.object({
  email: z.string().email(),
  role: z.enum(["PREP_ONLY", "SETTLEMENT"]).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.email)
    return NextResponse.json({ items: [] }, { status: 401 });

  const rows = await prisma.butcherAdmin.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      role: r.role,
      userEmail: r.user?.email ?? null,
      userName: r.user?.name ?? null,
      createdAt: r.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parse = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parse.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parse.error.flatten() },
      { status: 400 }
    );
  }
  const { email, role } = parse.data;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user)
    return NextResponse.json(
      { error: "User not found for that email" },
      { status: 404 }
    );

  // upsert by userId unique constraint
  const admin = await prisma.butcherAdmin.upsert({
    where: { userId: user.id },
    create: { userId: user.id, role: (role as any) ?? "PREP_ONLY" },
    update: { role: (role as any) ?? "PREP_ONLY" },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  return NextResponse.json({
    admin: {
      id: admin.id,
      userId: admin.userId,
      role: admin.role,
      userEmail: admin.user?.email ?? null,
      userName: admin.user?.name ?? null,
      createdAt: admin.createdAt,
    },
  });
}
