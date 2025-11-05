import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, OrderState } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { sendEmail } from "@/lib/mails";
import { readyForPickupHtml } from "@/lib/emailTemplates";

const prisma = new PrismaClient();

const bodySchema = z.object({
  state: z.enum(["AT_GYM", "PICKED_UP", "CANCELLED"] as const),
});

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

// NOTE: Next.js validator expects `params` as a Promise in this route
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminGymIds = await getAdminGymIds(session.user.email);
  if (adminGymIds.length === 0) {
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

  const existing = await prisma.order.findUnique({
    where: { id },
    select: { id: true, state: true, pickupGymId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!existing.pickupGymId || !adminGymIds.includes(existing.pickupGymId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allowed = ALLOWED_NEXT[existing.state] ?? [];
  if (!allowed.includes(nextState)) {
    return NextResponse.json(
      {
        error: `Invalid transition: ${existing.state} -> ${nextState}`,
        allowedNext: allowed,
      },
      { status: 400 }
    );
  }

  // Update order and include user so we can notify on AT_GYM
  const updated = await prisma.order.update({
    where: { id: existing.id },
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
      user: { select: { email: true, name: true } },
    },
  });

  // Send email on arrival after perform update and have `updated` with user + fields selected:
  if (nextState === "AT_GYM" && updated.user?.email) {
    try {
      const lines = await prisma.orderLine.findMany({
        where: { orderId: updated.id },
        select: { qty: true, productName: true, unitLabel: true },
        orderBy: { id: "asc" },
      });
      await sendEmail({
        to: updated.user.email,
        subject: `Order #${updated.shortCode} ready for pickup`,
        html: readyForPickupHtml({
          shortCode: updated.shortCode,
          pickupGymName: updated.pickupGymName,
          pickupWhen: updated.pickupWhen,
          lines: lines.map((l) => ({
            qty: l.qty,
            name: l.productName,
            unit: l.unitLabel,
          })),
          totalCents: updated.totalCents,
        }),
      });
    } catch (e) {
      console.error("Ready-for-pickup email failed:", e);
    }
  }

  return NextResponse.json({ order: updated });
}
