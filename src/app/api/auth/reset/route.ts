export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { hashPassword } from "@/lib/password";

const prisma = new PrismaClient();

const schema = z.object({
  token: z.string().min(8),
  newPassword: z
    .string()
    .min(8)
    .refine(
      (v) => /[A-Za-z]/.test(v) && /\d/.test(v),
      "Must include letters and numbers"
    ),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { token, newPassword } = parsed.data;

  const row = await prisma.verificationToken.findFirst({
    where: { token, identifier: { startsWith: "reset:" } },
  });
  if (!row || row.expires < new Date()) {
    return NextResponse.json(
      { error: "Token invalid or expired" },
      { status: 400 }
    );
  }

  // identifier format: reset:<userId>
  const [, userId] = row.identifier.split(":");
  if (!userId) {
    return NextResponse.json({ error: "Token invalid" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 400 });
  }

  const newHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    }),
    prisma.verificationToken.delete({
      where: { identifier_token: { identifier: row.identifier, token } },
    }),
    // logout everywhere (no-op in jwt mode, harmless otherwise)
    prisma.session.deleteMany({ where: { userId } }),
  ]);

  return NextResponse.json({ ok: true });
}
