import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, OrderState } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";

const prisma = new PrismaClient();

// gym-admin can only move to these states:
const bodySchema = z.object({
  state: z.enum(["AT_GYM", "PICKED_UP", "CANCELLED"] as const),
});

// allowed transitions for gym-admin only
const ALLOWED_NEXT: Record<OrderState, OrderState[]> = {
  PENDING: [],
  PREPARING: [],
  READY_FOR_DELIVERY: [],
  IN_TRANSIT: ["AT_GYM"],
  AT_GYM: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: [],
  CANCELLED: [],
};

async function getAdminGymIds(email: string) {
  const rows = await prisma.gymAdmin.findMany({
    where: { user: { email } },
    select: { gymId: true },
  });
  return rows.map((r) => r.gymId);
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> } // <- params is a Promise
) {
  const { id } = await ctx.params; // <- await it

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminGymIds = await getAdminGymIds(session.user.email);
  if (adminGymIds.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parse = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parse.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parse.error.flatten() },
      { status: 400 }
    );
  }
  const nextState = parse.data.state as OrderState;

  const order = await prisma.order.findUnique({
    where: { id },
    select: { id: true, state: true, pickupGymId: true },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!order.pickupGymId || !adminGymIds.includes(order.pickupGymId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allowed = ALLOWED_NEXT[order.state] ?? [];
  if (!allowed.includes(nextState)) {
    return NextResponse.json(
      {
        error: `Invalid transition: ${order.state} -> ${nextState}`,
        allowedNext: allowed,
      },
      { status: 400 }
    );
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      state: nextState,
      ...(nextState === "AT_GYM" && { pickupWhen: new Date() }),
    },
    select: {
      id: true,
      shortCode: true,
      state: true,
      totalCents: true,
      pickupGymName: true,
      pickupWhen: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ order: updated });
}
