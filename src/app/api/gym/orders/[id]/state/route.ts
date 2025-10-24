import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, OrderState } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";

const prisma = new PrismaClient();

const schema = z.object({
  state: z.nativeEnum(OrderState),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const me = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Find order + ensure this user is admin of its pickup gym
  const order = await prisma.order.findUnique({
    where: { id },
    select: { id: true, pickupGymId: true },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!order.pickupGymId) {
    return NextResponse.json(
      { error: "Order has no pickup gym" },
      { status: 400 }
    );
  }

  const isAdmin = await prisma.gymAdmin.findFirst({
    where: { userId: me.id, gymId: order.pickupGymId },
    select: { id: true },
  });
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { state: parsed.data.state },
    select: { id: true, state: true },
  });

  return NextResponse.json({ order: updated });
}
