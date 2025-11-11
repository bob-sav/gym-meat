// src/app/api/account/change-email/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { randomToken } from "@/lib/tokens";
import { sendEmail } from "@/lib/mails";
import { verifyEmailHtml } from "@/lib/emailTemplates";

const prisma = new PrismaClient();
const schema = z.object({ newEmail: z.string().email() });

export async function POST(req: NextRequest) {
  const session = await auth();

  // 1) Resolve currentUser via id OR email (fallback)
  const sessionId = (session?.user as any)?.id as string | undefined;
  const sessionEmail = session?.user?.email ?? undefined;

  if (!sessionId && !sessionEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUser = sessionId
    ? await prisma.user.findUnique({
        where: { id: sessionId },
        select: { id: true, email: true },
      })
    : await prisma.user.findUnique({
        where: { email: sessionEmail! },
        select: { id: true, email: true },
      });

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) Parse & validate payload
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const newEmailRaw = parsed.data.newEmail;
  const newEmail = newEmailRaw.trim().toLowerCase();
  const oldEmail = (currentUser.email ?? "").trim().toLowerCase();

  if (newEmail === oldEmail) {
    return NextResponse.json(
      { error: "New email is the same as current email" },
      { status: 400 }
    );
  }

  // 3) Ensure the new email isn't used by someone else
  const taken = await prisma.user.findUnique({
    where: { email: newEmail },
    select: { id: true },
  });
  if (taken && taken.id !== currentUser.id) {
    return NextResponse.json(
      { error: "Email already in use" },
      { status: 400 }
    );
  }

  // 4) Create/refresh verification token bound to *this user id* and target email
  const token = randomToken(24);
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h
  const identifier = `change:${currentUser.id}:${newEmail}`;

  await prisma.verificationToken
    .deleteMany({ where: { identifier } })
    .catch(() => {});
  await prisma.verificationToken.create({
    data: { identifier, token, expires },
  });

  // 5) Build absolute verify link and send mail
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    process.env.AUTH_URL ??
    "http://localhost:3000";

  const link = `${base}/api/account/verify-email-change?token=${encodeURIComponent(
    token
  )}`;

  try {
    await sendEmail({
      to: newEmail,
      subject: "Confirm your new email",
      html: verifyEmailHtml({ link }),
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
