import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, OrderState } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { isButcher } from "@/lib/butcher-auth";

const prisma = new PrismaClient();

const bodySchema = z.object({
  state: z.enum([
    "PREPARING",
    "READY_FOR_DELIVERY",
    "IN_TRANSIT",
    "CANCELLED",
  ] as const),
});

// allowed transitions for butcher
const ALLOWED_NEXT: Record<OrderState, OrderState[]> = {
  PENDING: ["PREPARING"],
  PREPARING: ["READY_FOR_DELIVERY", "CANCELLED"],
  READY_FOR_DELIVERY: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: [], // gym-admin takes over to AT_GYM
  AT_GYM: [], // gym-admin only
  PICKED_UP: [], // terminal
  CANCELLED: [], // terminal
};

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isButcher(session.user.email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const nextState = parsed.data.state as OrderState;

  const order = await prisma.order.findUnique({
    where: { id },
    select: { id: true, state: true },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
    data: { state: nextState },
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
