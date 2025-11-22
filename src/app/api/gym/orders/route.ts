// src/app/api/gym/orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, OrderState } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";

const prisma = new PrismaClient();

const qSchema = z.object({
  states: z.string().optional(),
  gymId: z.string().optional(),
});

const ALLOWED = new Set<OrderState>([
  "PENDING",
  "PREPARING",
  "READY_FOR_DELIVERY",
  "IN_TRANSIT",
  "AT_GYM",
  "PICKED_UP",
  "CANCELLED",
]);

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ items: [] }, { status: 401 });
  }

  // gyms current user may administer
  const adminRows = await prisma.gymAdmin.findMany({
    where: { user: { email: session.user.email } },
    select: { gymId: true },
  });
  const permittedGymIds = adminRows.map((r) => r.gymId);
  if (permittedGymIds.length === 0) {
    return NextResponse.json({ items: [] }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const parsed = qSchema.safeParse({
    states: searchParams.get("states") ?? undefined,
    gymId: searchParams.get("gymId") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // target gyms = specific gym (if permitted) OR all permitted gyms
  let targetGymIds: string[] = permittedGymIds;
  if (parsed.data.gymId) {
    if (!permittedGymIds.includes(parsed.data.gymId)) {
      // no peeking into other gyms
      return NextResponse.json({ items: [] }, { status: 403 });
    }
    targetGymIds = [parsed.data.gymId];
  }

  // optional state filtering
  const statesArr = (parsed.data.states ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is OrderState => ALLOWED.has(s as OrderState));

  const where: any = { pickupGymId: { in: targetGymIds } };
  if (statesArr.length) where.state = { in: statesArr };

  const rows = await prisma.order.findMany({
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
        select: {
          id: true,
          productName: true,
          qty: true,
          unitLabel: true,
          basePriceCents: true,
          species: true,
          part: true,
          variantSizeGrams: true,
          optionsJson: true, // NEW
        },
        orderBy: { id: "asc" },
      },
    },
  });

  // map optionsJson -> prepLabels and strip optionsJson
  const items = rows.map((o) => ({
    ...o,
    lines: o.lines.map((l) => {
      const options = ((l as any).optionsJson as any[]) ?? [];
      const prepLabels = options
        .map((op) => op?.label as string | undefined)
        .filter(
          (label): label is string => !!label && typeof label === "string"
        );

      const { optionsJson, ...rest } = l as any;

      return {
        ...rest,
        prepLabels,
      };
    }),
  }));

  return NextResponse.json({ items });
}
