import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { isButcherSettler } from "@/lib/butcher-auth";

const prisma = new PrismaClient();

const bodySchema = z.object({
  notes: z.string().max(1000).optional(),
  dryRun: z.boolean().optional(), // when true: compute & return summary only
});

export async function POST(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email ?? "";
  if (!email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await isButcherSettler(email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parse = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parse.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parse.error.flatten() },
      { status: 400 }
    );
  }
  const { notes, dryRun } = parse.data;

  // Who is making the settlement?
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Eligible orders = picked up, gym already settled, not yet butcher-settled
  const toSettle = await prisma.order.findMany({
    where: {
      state: "PICKED_UP",
      gymSettlementId: { not: null },
      butcherSettlementId: null,
    },
    select: { id: true, totalCents: true, shortCode: true },
    orderBy: { createdAt: "asc" },
  });

  const eligibleCount = toSettle.length;
  const totalCents = toSettle.reduce((s, o) => s + (o.totalCents || 0), 0);

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      eligibleCount,
      totalCents,
      sample: toSettle.slice(0, 10),
    });
  }

  if (!eligibleCount) {
    return NextResponse.json({
      ok: true,
      settlementId: null,
      count: 0,
      totalCents: 0,
    });
  }

  const settlement = await prisma.$transaction(async (tx) => {
    const st = await tx.butcherSettlement.create({
      data: {
        createdByUserId: user.id,
        orderCount: eligibleCount,
        totalCents,
        notes: notes ?? null,
      },
    });

    await tx.order.updateMany({
      where: { id: { in: toSettle.map((o) => o.id) } },
      data: { butcherSettlementId: st.id },
    });

    return st;
  });

  return NextResponse.json({
    ok: true,
    settlementId: settlement.id,
    count: eligibleCount,
    totalCents,
  });
}
