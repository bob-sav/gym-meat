// src/app/api/gym/orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, OrderState } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";

const prisma = new PrismaClient();

const querySchema = z.object({
  state: z
    .enum([
      "PENDING",
      "PREPARING",
      "READY_FOR_DELIVERY",
      "IN_TRANSIT",
      "AT_GYM",
      "PICKED_UP",
      "CANCELLED",
    ] as const)
    .optional(),
  states: z.string().optional(), // NEW: comma-separated list
});

async function getAdminGymIds(email: string) {
  const rows = await prisma.gymAdmin.findMany({
    where: { user: { email } },
    select: { gymId: true },
  });
  return rows.map((r) => r.gymId);
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ items: [] }, { status: 401 });
  }

  const gymIds = await getAdminGymIds(session.user.email);
  if (!gymIds.length) {
    return NextResponse.json({ items: [] }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    state: searchParams.get("state") ?? undefined,
    states: searchParams.get("states") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { state, states } = parsed.data;

  // Build where
  const where: any = { pickupGymId: { in: gymIds } };

  if (states) {
    const arr = states
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean) as OrderState[];
    if (arr.length) where.state = { in: arr };
  } else if (state) {
    where.state = state as OrderState;
  }

  const items = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      shortCode: true,
      state: true,
      totalCents: true,
      pickupGymName: true,
      pickupWhen: true,
      createdAt: true,
      gymSettlementId: true,
      lines: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          productName: true,
          qty: true,
          unitLabel: true,
          basePriceCents: true,
          species: true,
          part: true,
        },
      },
    },
  });

  return NextResponse.json({ items });
}
