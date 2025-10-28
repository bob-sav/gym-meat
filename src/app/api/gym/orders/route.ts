// src/app/api/gym/orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, OrderState } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";

const prisma = new PrismaClient();

const stateEnum = z.enum([
  "PENDING",
  "PREPARING",
  "READY_FOR_DELIVERY",
  "IN_TRANSIT",
  "AT_GYM",
  "PICKED_UP",
  "CANCELLED",
] as const);

function parseStates(sp: URLSearchParams): OrderState[] | null {
  // support multiple ?state=... params, or a single one
  const many = sp.getAll("state");
  if (many.length === 0) return null;
  const parsed: OrderState[] = [];
  for (const raw of many) {
    const out = stateEnum.safeParse(raw);
    if (!out.success) continue;
    parsed.push(out.data as OrderState);
  }
  return parsed.length ? parsed : null;
}

// Fetch the gym IDs this user administers
async function getAdminGymIds(email: string) {
  const rows = await prisma.gymAdmin.findMany({
    where: { user: { email } },
    select: { gymId: true },
  });
  return rows.map((r) => r.gymId);
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Require login
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ items: [] }, { status: 401 });
  }

  // Must be an admin for at least one gym
  const adminGymIds = await getAdminGymIds(session.user.email);
  if (adminGymIds.length === 0) {
    return NextResponse.json({ items: [] }, { status: 403 });
  }

  // Parse filters
  const { searchParams } = new URL(req.url);
  const states = parseStates(searchParams);

  // Default view for gym admins: what's relevant right now
  // (arriving or ready for handoff)
  const effectiveStates: OrderState[] =
    states ?? (["IN_TRANSIT", "AT_GYM"] as OrderState[]);

  // Query orders for the gyms this admin manages
  const orders = await prisma.order.findMany({
    where: {
      pickupGymId: { in: adminGymIds },
      state: { in: effectiveStates },
    },
    orderBy: { createdAt: "asc" },
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
          optionsJson: true, // derive prepLabels below
        },
      },
    },
  });

  // Shape response + compute prepLabels (labels from optionsJson)
  const items = orders.map((o) => ({
    id: o.id,
    shortCode: o.shortCode,
    state: o.state,
    totalCents: o.totalCents,
    pickupGymName: o.pickupGymName ?? null,
    pickupWhen: o.pickupWhen ?? null,
    createdAt: o.createdAt,
    lines: o.lines.map((l) => {
      const opts = Array.isArray(l.optionsJson) ? l.optionsJson : [];
      const prepLabels = opts
        .map((x: any) => x?.label)
        .filter(
          (v: unknown): v is string => typeof v === "string" && v.length > 0
        );

      return {
        id: l.id,
        productName: l.productName,
        qty: l.qty,
        unitLabel: l.unitLabel,
        basePriceCents: l.basePriceCents,
        species: l.species,
        part: l.part ?? null,
        variantSizeGrams: l.variantSizeGrams ?? null,
        prepLabels,
      };
    }),
  }));

  return NextResponse.json({ items });
}
