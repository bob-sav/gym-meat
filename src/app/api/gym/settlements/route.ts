export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";

const prisma = new PrismaClient();

const bodySchema = z.object({
  gymId: z.string().min(1).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // current user id (required for createdByUserId)
  const me = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!me)
    return NextResponse.json({ error: "User not found" }, { status: 400 });

  // gyms this user administers
  const adminGyms = await prisma.gymAdmin.findMany({
    where: { user: { email: session.user.email } },
    select: { gymId: true },
  });
  const permittedGymIds = adminGyms.map((g) => g.gymId);

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  let gymId = parsed.data.gymId;

  // If gymId not provided, try to infer it:
  // - If user has exactly 1 permitted gym -> use it
  // - Else, check how many gyms currently have picked-up & unsettled orders
  if (!gymId) {
    if (permittedGymIds.length === 1) {
      gymId = permittedGymIds[0];
    } else {
      const gymsWithUnsettled = await prisma.order.findMany({
        where: {
          pickupGymId: { in: permittedGymIds },
          state: "PICKED_UP",
          gymSettlementId: null,
        },
        select: { pickupGymId: true },
        distinct: ["pickupGymId"],
      });
      if (gymsWithUnsettled.length === 1 && gymsWithUnsettled[0].pickupGymId) {
        gymId = gymsWithUnsettled[0].pickupGymId!;
      } else {
        return NextResponse.json(
          { error: "No permitted gym selected" },
          { status: 400 }
        );
      }
    }
  }

  if (!permittedGymIds.includes(gymId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // find all picked-up but unsettled orders for this gym
  const toSettle = await prisma.order.findMany({
    where: {
      pickupGymId: gymId,
      state: "PICKED_UP",
      gymSettlementId: null,
    },
    select: { id: true, totalCents: true },
  });

  if (!toSettle.length) {
    return NextResponse.json({ ok: true, count: 0, totalCents: 0 });
  }

  const totalCents = toSettle.reduce((s, o) => s + (o.totalCents || 0), 0);

  const settlement = await prisma.$transaction(async (tx) => {
    const st = await tx.gymSettlement.create({
      data: {
        gymId,
        totalCents,
        orderCount: toSettle.length,
        createdByUserId: me.id, // << required by your schema
      },
    });

    await tx.order.updateMany({
      where: { id: { in: toSettle.map((o) => o.id) } },
      data: { gymSettlementId: st.id },
    });

    return st;
  });

  return NextResponse.json({
    ok: true,
    settlementId: settlement.id,
    count: toSettle.length,
    totalCents,
  });
}
