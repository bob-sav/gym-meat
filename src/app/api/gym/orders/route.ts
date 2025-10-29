// src/app/api/gym/orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, OrderState } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";

const prisma = new PrismaClient();

// ...top imports unchanged
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ items: [] }, { status: 401 });
  }

  // which gyms the admin can see
  const adminGyms = await prisma.gymAdmin.findMany({
    where: { user: { email: session.user.email } },
    select: { gymId: true, gym: { select: { id: true, name: true } } },
  });
  const permittedGymIds = adminGyms.map((g) => g.gymId);

  // states param (optional)
  const { searchParams } = new URL(req.url);
  const statesParam = searchParams.get("states") || "";
  const states = statesParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const items = await prisma.order.findMany({
    where: {
      pickupGymId: { in: permittedGymIds },
      ...(states.length ? { state: { in: states as any } } : {}),
    },
    orderBy: { createdAt: "desc" },
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
        select: {
          id: true,
          productName: true,
          qty: true,
          unitLabel: true,
          basePriceCents: true,
          species: true,
          part: true,
          variantSizeGrams: true,
        },
        orderBy: { id: "asc" },
      },
    },
  });

  // NEW: return gyms the admin can operate on
  const gyms = adminGyms.map((g) => ({
    id: g.gym.id,
    name: g.gym.name,
  }));

  return NextResponse.json({ items, gyms });
}
