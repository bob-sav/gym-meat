import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, OrderState } from "@prisma/client";
import { auth } from "@/auth";

const prisma = new PrismaClient();

// helper: which gyms this user administers
async function getAdminGymIds(email: string) {
  const rows = await prisma.gymAdmin.findMany({
    where: { user: { email } },
    select: { gymId: true },
  });
  return rows.map((r) => r.gymId);
}

// POST /api/gym/settlements
// Creates a settlement for all PICKED_UP & UNSETTLED orders per the admin's gyms.
// Optional body: { gymId?: string } to select a single gym if the admin has multiple.
export async function POST(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminGyms = await getAdminGymIds(email);
  if (adminGyms.length === 0)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const requestedGymId =
    typeof body?.gymId === "string" ? body.gymId : undefined;

  const gymIds = requestedGymId
    ? adminGyms.includes(requestedGymId)
      ? [requestedGymId]
      : []
    : adminGyms;

  if (gymIds.length === 0) {
    return NextResponse.json(
      { error: "No permitted gym selected" },
      { status: 400 }
    );
  }

  // We’ll process one gym per call for simplicity (front-end can call per gym)
  const gymId = gymIds[0];

  // Load unsettled PICKED_UP orders for this gym
  const orders = await prisma.order.findMany({
    where: {
      pickupGymId: gymId,
      state: OrderState.PICKED_UP,
      gymSettlementId: null,
    },
    select: { id: true, totalCents: true },
  });

  if (!orders.length) {
    return NextResponse.json({ error: "Nothing to settle" }, { status: 400 });
  }

  // find admin user id
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user)
    return NextResponse.json({ error: "User missing" }, { status: 400 });

  const total = orders.reduce((sum, o) => sum + (o.totalCents || 0), 0);

  const settlement = await prisma.$transaction(async (tx) => {
    const s = await tx.gymSettlement.create({
      data: {
        gymId,
        createdByUserId: user.id,
        totalCents: total,
      },
      select: { id: true, gymId: true, totalCents: true, createdAt: true },
    });

    await tx.order.updateMany({
      where: { id: { in: orders.map((o) => o.id) } },
      data: { gymSettlementId: s.id },
    });

    return s;
  });

  return NextResponse.json({
    settlement,
    count: orders.length,
    totalCents: total,
  });
}
