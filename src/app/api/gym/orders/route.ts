import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, OrderState } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";

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

async function getAdminGymIds(email: string) {
  const rows = await prisma.gymAdmin.findMany({
    where: { user: { email } },
    select: { gymId: true },
  });
  return rows.map((r) => r.gymId);
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ items: [] }, { status: 401 });
  }

  const adminGymIds = await getAdminGymIds(session.user.email);
  if (adminGymIds.length === 0) {
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

  // Default states to show at a gym
  const stateFilter = parsed.data.state
    ? [parsed.data.state as OrderState]
    : (["IN_TRANSIT", "AT_GYM"] as OrderState[]);

  const items = await prisma.order.findMany({
    where: {
      pickupGymId: { in: adminGymIds },
      state: { in: stateFilter },
    },
    orderBy: [{ state: "asc" }, { createdAt: "asc" }],
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
          optionsJson: true, // for quick prep label extract client-side if needed
        },
      },
    },
  });

  return NextResponse.json({ items });
}
