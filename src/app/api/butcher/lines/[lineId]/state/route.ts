import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, LineState } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { isButcher } from "@/lib/butcher-auth";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

const bodySchema = z.object({
  state: z.enum(["PENDING", "PREPARING", "READY", "SENT"]),
});

// Optional: guard illegal jumps (PENDING->SENT, etc.)
const allowedNext: Record<LineState, LineState[]> = {
  PENDING: ["PREPARING"],
  PREPARING: ["PENDING", "READY"],
  READY: ["PREPARING", "SENT"],
  SENT: [], // terminal for butcher side
};

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ lineId: string }> } // <-- important
) {
  const { lineId } = await ctx.params; // <-- await the params

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isButcher(session.user.email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parse = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parse.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parse.error.flatten() },
      { status: 400 }
    );
  }

  const nextState = parse.data.state as LineState;

  const line = await prisma.orderLine.findUnique({
    where: { id: lineId },
    select: { lineState: true },
  });
  if (!line) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowed = allowedNext[line.lineState] ?? [];
  if (!allowed.includes(nextState)) {
    return NextResponse.json(
      {
        error: `Invalid transition: ${line.lineState} -> ${nextState}`,
        allowedNext: allowed,
      },
      { status: 400 }
    );
  }

  await prisma.orderLine.update({
    where: { id: lineId },
    data: { lineState: nextState },
  });

  return NextResponse.json({ ok: true });
}
