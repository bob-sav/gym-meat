import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { isButcher } from "@/lib/butcher-auth";

const prisma = new PrismaClient();

const bodySchema = z.object({
  state: z.enum(["PENDING", "PREPARING", "READY", "SENT"]),
});

// Allowed single-step transitions per line (butcher side)
const ALLOWED: Record<string, string[]> = {
  PENDING: ["PREPARING"],
  PREPARING: ["READY", "PENDING"],
  READY: ["PREPARING", "SENT"],
  SENT: ["READY"], // minor undo
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ lineId: string }> }
) {
  // auth
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isButcher(session.user.email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // params
  const { lineId } = await params;

  // body
  const parse = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parse.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parse.error.flatten() },
      { status: 400 }
    );
  }
  const nextState = parse.data.state;

  // fetch current line + parent order id
  const line = await prisma.orderLine.findUnique({
    where: { id: lineId },
    select: { id: true, orderId: true, lineState: true },
  });
  if (!line) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // if trying to undo from SENT, only allow while the parent order is still IN_TRANSIT
  if (line.lineState === "SENT" && nextState === "READY") {
    const parent = await prisma.order.findUnique({
      where: { id: line.orderId },
      select: { state: true },
    });
    if (!parent || parent.state !== "IN_TRANSIT") {
      return NextResponse.json(
        { error: "Cannot undo SENT after arrival" },
        { status: 400 }
      );
    }
  }

  // guard transition
  const allowedNext = ALLOWED[line.lineState] ?? [];
  if (!allowedNext.includes(nextState)) {
    return NextResponse.json(
      { error: `Invalid transition ${line.lineState} -> ${nextState}` },
      { status: 400 }
    );
  }

  // apply update and adjust parent order state in a transaction
  await prisma.$transaction(async (tx) => {
    // 1) update the line state
    await tx.orderLine.update({
      where: { id: lineId },
      data: { lineState: nextState as any },
    });

    // 2) recompute parent order aggregate -> set order.state
    const siblingStates = await tx.orderLine.findMany({
      where: { orderId: line.orderId },
      select: { lineState: true },
    });

    let newOrderState:
      | "PENDING"
      | "PREPARING"
      | "READY_FOR_DELIVERY"
      | "IN_TRANSIT";
    const anySent = siblingStates.some((s) => s.lineState === "SENT");
    const allReady = siblingStates.every((s) => s.lineState === "READY");
    const anyPreparing = siblingStates.some((s) => s.lineState === "PREPARING");

    if (anySent) newOrderState = "IN_TRANSIT";
    else if (allReady) newOrderState = "READY_FOR_DELIVERY";
    else if (anyPreparing) newOrderState = "PREPARING";
    else newOrderState = "PENDING";

    await tx.order.update({
      where: { id: line.orderId },
      data: { state: newOrderState },
    });
  });

  return NextResponse.json({ ok: true });
}
