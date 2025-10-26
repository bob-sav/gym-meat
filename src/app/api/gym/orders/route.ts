// src/app/api/gym/orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";

const prisma = new PrismaClient();

async function getAdminGymIds(email: string) {
  const rows = await prisma.gymAdmin.findMany({
    where: { user: { email } },
    select: { gymId: true },
  });
  return rows.map((r) => r.gymId);
}

// GET /api/gym/orders?state=AT_GYM
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ items: [] }, { status: 401 });
  }

  const gymIds = await getAdminGymIds(session.user.email);
  if (gymIds.length === 0) return NextResponse.json({ items: [] });

  const url = new URL(req.url);
  const stateFilter = url.searchParams.get("state") as
    | "IN_TRANSIT"
    | "AT_GYM"
    | "PICKED_UP"
    | "CANCELLED"
    | null;

  const items = await prisma.order.findMany({
    where: {
      pickupGymId: { in: gymIds },
      ...(stateFilter ? { state: stateFilter } : {}),
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
      user: { select: { name: true, email: true } },
      lines: {
        select: {
          id: true,
          productName: true,
          qty: true,
          unitLabel: true,
          basePriceCents: true,
          species: true,
          part: true,
        },
        orderBy: { id: "asc" },
      },
    },
  });

  return NextResponse.json({ items });
}
