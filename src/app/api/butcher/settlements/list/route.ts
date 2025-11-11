// src/app/api/butcher/settlements/list/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { isButcher } from "@/lib/butcher-auth";

const prisma = new PrismaClient();

export async function GET() {
  const session = await auth();
  const email = session?.user?.email ?? "";
  if (!email) return NextResponse.json({ items: [] }, { status: 401 });

  if (!(await isButcher(email))) {
    return NextResponse.json({ items: [] }, { status: 403 });
  }

  const items = await prisma.butcherSettlement.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      totalCents: true,
      orderCount: true,
      notes: true,
      createdBy: { select: { id: true, name: true, email: true } },
      orders: { select: { id: true, shortCode: true, totalCents: true } },
    },
  });

  return NextResponse.json({ items });
}
