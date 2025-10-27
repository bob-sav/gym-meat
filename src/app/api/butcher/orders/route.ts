import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, OrderState } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { isButcher } from "@/lib/butcher-auth";

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
});

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // auth + butcher gate
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ items: [] }, { status: 401 });
  }
  if (!(await isButcher(session.user.email))) {
    return NextResponse.json({ items: [] }, { status: 403 });
  }

  // parse ?state=
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

  const where = parsed.data.state
    ? ({ state: parsed.data.state as OrderState } as const)
    : ({} as const);

  // fetch orders + lines
  const rows = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "asc" }, // FIFO for prep
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
          variantSizeGrams: true,
          // we won't expose optionsJson directly; we derive prepLabels from it
          optionsJson: true,
          lineState: true,
        },
      },
    },
  });

  // enrich lines -> add prepLabels, keep variantSizeGrams
  const items = rows.map((order) => ({
    id: order.id,
    shortCode: order.shortCode,
    state: order.state,
    totalCents: order.totalCents,
    pickupGymName: order.pickupGymName,
    pickupWhen: order.pickupWhen,
    createdAt: order.createdAt,
    lines: order.lines.map((l) => ({
      id: l.id,
      productName: l.productName,
      qty: l.qty,
      unitLabel: l.unitLabel,
      basePriceCents: l.basePriceCents,
      species: l.species,
      part: l.part,
      variantSizeGrams: l.variantSizeGrams,
      prepLabels: Array.isArray(l.optionsJson)
        ? (l.optionsJson.map((o: any) => o?.label).filter(Boolean) as string[])
        : [],
      lineState: l.lineState, // ← pass through
    })),
  }));

  return NextResponse.json({ items });
}
