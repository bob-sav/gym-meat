import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { isButcher } from "@/lib/butcher-auth";

const prisma = new PrismaClient();

type LineState = "PENDING" | "PREPARING" | "READY" | "SENT";

const bodySchema = z.object({
  state: z.enum(["PENDING", "PREPARING", "READY", "SENT"]),
});

// Allowed single-step transitions
const ALLOWED_NEXT: Record<LineState, LineState[]> = {
  PENDING: ["PREPARING"],
  PREPARING: ["READY", "PENDING"],
  READY: ["PREPARING", "SENT"], // SENT is allowed but gated by order readiness
  SENT: ["READY"], // small undo
};

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ lineId: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isButcher(session.user.email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { lineId } = await ctx.params;

  const parse = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parse.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parse.error.flatten() },
      { status: 400 }
    );
  }
  const next = parse.data.state as LineState;

  const line = await prisma.orderLine.findUnique({
    where: { id: lineId },
    select: {
      id: true,
      orderId: true,
      lineState: true,
      order: { select: { id: true, state: true } },
    },
  });
  if (!line) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // restrict editing when order already left butcher domain
  if (
    !["PENDING", "PREPARING", "READY_FOR_DELIVERY", "IN_TRANSIT"].includes(
      line.order.state
    )
  ) {
    return NextResponse.json(
      { error: "Order not editable in current state" },
      { status: 400 }
    );
  }

  // step guard
  const allowed = ALLOWED_NEXT[line.lineState] ?? [];
  if (!allowed.includes(next)) {
    return NextResponse.json(
      {
        error: `Invalid transition: ${line.lineState} -> ${next}`,
        allowedNext: allowed,
      },
      { status: 400 }
    );
  }

  // If trying to mark this line SENT, only allow if *all* lines in the order are READY (or this line will be last)
  if (next === "SENT") {
    const counts = await prisma.orderLine.groupBy({
      by: ["lineState"],
      where: { orderId: line.orderId },
      _count: { _all: true },
    });
    const total = counts.reduce((s, c) => s + c._count._all, 0);
    const readyCount =
      counts.find((c) => c.lineState === "READY")?._count._all ?? 0;

    // If this line is not READY yet, or other lines are not READY, block
    const thisIsReady = line.lineState === "READY";
    if (!thisIsReady || readyCount < total) {
      return NextResponse.json(
        { error: "All lines must be READY before sending out." },
        { status: 400 }
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.orderLine.update({
      where: { id: lineId },
      data: { lineState: next },
    });

    // If we just SENT the last READY line, promote order to IN_TRANSIT
    if (next === "SENT") {
      const remainingReady = await tx.orderLine.count({
        where: { orderId: line.orderId, lineState: "READY" },
      });
      if (remainingReady === 0) {
        await tx.order.update({
          where: { id: line.orderId },
          data: { state: "IN_TRANSIT" },
        });
      }
    }

    // If any line moves to PREPARING and order is PENDING, bump order
    if (next === "PREPARING" && line.order.state === "PENDING") {
      await tx.order.update({
        where: { id: line.orderId },
        data: { state: "PREPARING" },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
