import { NextResponse } from "next/server";
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

// GET /api/gym/settlements/list?gymId=optional
export async function GET(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ items: [] }, { status: 401 });

  const adminGyms = await getAdminGymIds(email);
  if (adminGyms.length === 0)
    return NextResponse.json({ items: [] }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const gymId = searchParams.get("gymId") || undefined;

  const where =
    gymId && adminGyms.includes(gymId)
      ? { gymId }
      : { gymId: { in: adminGyms } };

  const items = await prisma.gymSettlement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      gymId: true,
      totalCents: true,
      orderCount: true,
      createdAt: true,
      createdBy: { select: { id: true, email: true, name: true } },
      orders: { select: { id: true, shortCode: true, totalCents: true } },
    },
  });

  return NextResponse.json({ items });
}
