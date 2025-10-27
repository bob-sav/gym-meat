import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, OrderState } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { isButcher } from "@/lib/butcher-auth";

const prisma = new PrismaClient();

const querySchema = z.object({
  state: z.enum(["PENDING", "PREPARING", "READY", "SENT"]).optional(),
});

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ items: [] }, { status: 401 });
  }
  if (!(await isButcher(session.user.email))) {
    return NextResponse.json({ items: [] }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    state: searchParams.get("state") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const lineStateFilter = parsed.data.state;

  // Pull orders still in the butcher domain
  const ORDERS_SCOPE: OrderState[] = [
    "PENDING",
    "PREPARING",
    "READY_FOR_DELIVERY",
    "IN_TRANSIT", // optional: you can drop this if you want SENT to disappear when order moves out
  ];

  const orders = await prisma.order.findMany({
    where: { state: { in: ORDERS_SCOPE } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      shortCode: true,
      pickupGymName: true,
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
          variantSizeGrams: true,
          prepLabels: true, // Json[] -> string[]
          lineState: true,
        },
      },
    },
  });

  // Flatten lines and compute index like "2 of 5"
  const items: Array<{
    id: string; // lineId
    orderId: string;
    shortCode: string;
    createdAt: string;
    pickupGymName: string | null;

    // line details
    productName: string;
    qty: number;
    unitLabel: string | null;
    basePriceCents: number;
    species: string;
    part: string | null;
    variantSizeGrams: number | null;
    prepLabels: string[];

    lineState: "PENDING" | "PREPARING" | "READY" | "SENT";
    indexOf: { i: number; n: number }; // e.g., {i:2,n:5}
  }> = [];

  for (const o of orders) {
    const n = o.lines.length;
    o.lines.forEach((l, idx) => {
      if (lineStateFilter && l.lineState !== lineStateFilter) return;
      items.push({
        id: l.id,
        orderId: o.id,
        shortCode: o.shortCode,
        createdAt: o.createdAt.toISOString(),
        pickupGymName: o.pickupGymName ?? null,

        productName: l.productName,
        qty: l.qty,
        unitLabel: l.unitLabel,
        basePriceCents: l.basePriceCents,
        species: l.species as string,
        part: l.part as string | null,
        variantSizeGrams: l.variantSizeGrams,
        prepLabels: Array.isArray(l.prepLabels)
          ? (l.prepLabels as string[])
          : [],

        lineState: l.lineState as any,
        indexOf: { i: idx + 1, n },
      });
    });
  }

  return NextResponse.json({ items });
}
