import { NextResponse } from "next/server";
import { PrismaClient, OrderState } from "@prisma/client";
import { auth } from "@/auth";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

// GET /api/gym/orders?state=AT_GYM|READY_FOR_DELIVERY|PENDING|...
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ items: [] }, { status: 401 });
  }

  const me = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!me) return NextResponse.json({ items: [] }, { status: 401 });

  // gyms this user administers
  const adminGyms = await prisma.gymAdmin.findMany({
    where: { userId: me.id },
    select: { gymId: true },
  });
  const gymIds = adminGyms.map((g) => g.gymId);
  if (!gymIds.length) return NextResponse.json({ items: [] });

  const url = new URL(req.url);
  const stateParam = url.searchParams.get("state") as OrderState | null;

  const items = await prisma.order.findMany({
    where: {
      pickupGymId: { in: gymIds },
      ...(stateParam ? { state: stateParam } : {}),
    },
    orderBy: [{ state: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      shortCode: true,
      state: true,
      totalCents: true,
      pickupGymName: true,
      pickupWhen: true,
      createdAt: true,
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
