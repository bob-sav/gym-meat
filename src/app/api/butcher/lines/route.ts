// src/app/api/butcher/lines/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, LineState, OrderState } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { isButcher } from "@/lib/butcher-auth";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

const querySchema = z.object({
  lineState: z.enum(["PENDING", "PREPARING", "READY", "SENT"]).optional(),
  // optional: let butchers filter by overall order state too (e.g., hide AT_GYM/PICKED_UP)
  orderState: z
    .enum([
      "PENDING",
      "PREPARING",
      "READY_FOR_DELIVERY",
      "IN_TRANSIT",
      "AT_GYM",
      "PICKED_UP",
      "CANCELLED",
    ])
    .optional(),
});

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
    lineState: searchParams.get("lineState") ?? undefined,
    orderState: searchParams.get("orderState") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { lineState, orderState } = parsed.data;

  const where: any = {};
  if (lineState) where.lineState = lineState as LineState;
  if (orderState) where.order = { state: orderState as OrderState };

  const rows = await prisma.orderLine.findMany({
    where,
    orderBy: [
      { order: { createdAt: "asc" } }, // FIFO by order time
      { id: "asc" }, // stable secondary sort
    ],
    select: {
      id: true,
      orderId: true,
      productName: true,
      qty: true,
      unitLabel: true,
      basePriceCents: true,
      species: true,
      part: true,
      variantSizeGrams: true,
      lineState: true,
      optionsJson: true,
      order: {
        select: {
          id: true,
          shortCode: true,
          state: true,
          pickupGymName: true,
          createdAt: true,
        },
      },
    },
  });

  type ButcherLineItem = {
    id: string;
    orderId: string;
    shortCode: string;
    orderState: OrderState;
    createdAt: Date;
    pickupGymName: string | null;

    productName: string;
    qty: number;
    unitLabel: string | null;
    variantSizeGrams: number | null;
    species: string;
    part: string | null;
    basePriceCents: number;

    lineState: LineState;
    prepLabels: string[];
    indexOf: { i: number; n: number };
  };

  const items: ButcherLineItem[] = rows.map((l) => {
    const opts = Array.isArray(l.optionsJson) ? l.optionsJson : [];
    const prepLabels = opts
      .map((o: any) => o?.label)
      .filter(
        (x: unknown): x is string => typeof x === "string" && x.length > 0
      );

    return {
      id: l.id,
      orderId: l.orderId,
      shortCode: l.order.shortCode,
      orderState: l.order.state,
      createdAt: l.order.createdAt,
      pickupGymName: l.order.pickupGymName ?? null,

      productName: l.productName,
      qty: l.qty,
      unitLabel: l.unitLabel,
      variantSizeGrams: l.variantSizeGrams ?? null,
      species: l.species,
      part: l.part ?? null,
      basePriceCents: l.basePriceCents,

      lineState: l.lineState,
      prepLabels,
      indexOf: { i: 1, n: 1 }, // placeholder; will be overwritten below
    };
  });

  // Assign indexOf per order (1..n)
  const byOrder = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const it of items) {
    counts.set(it.orderId, (counts.get(it.orderId) ?? 0) + 1);
  }
  for (const it of items) {
    const nextI = (byOrder.get(it.orderId) ?? 0) + 1;
    byOrder.set(it.orderId, nextI);
    it.indexOf = { i: nextI, n: counts.get(it.orderId)! };
  }

  return NextResponse.json({ items });
}
