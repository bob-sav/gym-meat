// src/app/api/account/change-password/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { hashPassword } from "@/lib/password";

const prisma = new PrismaClient();

const schema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z
    .string()
    .min(8)
    .refine(
      (v) => /[A-Za-z]/.test(v) && /\d/.test(v),
      "Must include letters and numbers"
    ),
});

export async function POST(req: NextRequest) {
  const session = await auth();

  // Resolve current user via id, else email
  const sessionId = (session?.user as any)?.id as string | undefined;
  const sessionEmail = session?.user?.email ?? undefined;

  if (!sessionId && !sessionEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUser = sessionId
    ? await prisma.user.findUnique({
        where: { id: sessionId },
        select: { id: true, email: true, passwordHash: true },
      })
    : await prisma.user.findUnique({
        where: { email: sessionEmail! },
        select: { id: true, email: true, passwordHash: true },
      });

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (!currentUser.passwordHash) {
    return NextResponse.json({ error: "No password set" }, { status: 400 });
  }

  const ok = await bcrypt.compare(
    parsed.data.currentPassword,
    currentUser.passwordHash
  );
  if (!ok) {
    return NextResponse.json(
      { error: "Current password incorrect" },
      { status: 400 }
    );
  }

  // Optional: prevent reusing the same password
  if (await bcrypt.compare(parsed.data.newPassword, currentUser.passwordHash)) {
    return NextResponse.json(
      { error: "New password must be different" },
      { status: 400 }
    );
  }

  const newHash = await hashPassword(parsed.data.newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: currentUser.id },
      data: { passwordHash: newHash },
    }),
    // No-op if you're on JWT sessions, harmless otherwise:
    prisma.session.deleteMany({ where: { userId: currentUser.id } }),
  ]);

  return NextResponse.json({ ok: true });
}
