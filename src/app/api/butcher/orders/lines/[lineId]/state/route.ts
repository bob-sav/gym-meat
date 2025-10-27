import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { isButcher } from "@/lib/butcher-auth";

const prisma = new PrismaClient();

const bodySchema = z.object({
  state: z.enum(["PENDING", "PREPARING", "READY"]),
});

const ALLOWED: Record<string, string[]> = {
  PENDING: ["PREPARING"],
  PREPARING: ["READY", "PENDING"],
  READY: ["PREPARING"], // allow stepping back if needed
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: { lineId: string } }
) {
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
  const next = parse.data.state;

  const line = await prisma.orderLine.findUnique({
    where: { id: params.lineId },
    select: { id: true, lineState: true, orderId: true },
  });
  if (!line) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowed = ALLOWED[line.lineState] ?? [];
  if (!allowed.includes(next)) {
    return NextResponse.json(
      { error: `Invalid transition ${line.lineState} -> ${next}` },
      { status: 400 }
    );
  }

  await prisma.orderLine.update({
    where: { id: line.id },
    data: { lineState: next as any },
  });

  return NextResponse.json({ ok: true });
}
