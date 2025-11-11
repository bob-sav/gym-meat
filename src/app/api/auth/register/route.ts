// src/app/api/auth/register/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { hashPassword } from "@/lib/password";
import { randomToken } from "@/lib/tokens";
import { sendEmail } from "@/lib/mails";
import { verifyEmailHtml } from "@/lib/emailTemplates";

const prisma = new PrismaClient();

const schema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .refine(
      (v) => /[A-Za-z]/.test(v) && /\d/.test(v),
      "Must include letters and numbers"
    ),
  name: z.string().min(1).optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { email, password, name } = parsed.data;

  // Only select what we need
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailVerified: true, passwordHash: true },
  });

  let userId: string;
  if (!existing) {
    const passwordHash = await hashPassword(password);
    const u = await prisma.user.create({
      data: {
        email,
        name: name ?? null,
        passwordHash, // <- store into passwordHash
        emailVerified: null, // <- we’ll set this on verify
      },
      select: { id: true },
    });
    userId = u.id;
  } else {
    if (existing.emailVerified) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 400 }
      );
    }
    // If the unverified user was created via OAuth earlier, let them set a password now
    if (!existing.passwordHash) {
      const passwordHash = await hashPassword(password);
      await prisma.user.update({
        where: { email },
        data: { passwordHash },
      });
    }
    userId = existing.id;
  }

  // Create (or refresh) a verification token
  const token = randomToken(24);
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h
  await prisma.verificationToken
    .deleteMany({ where: { identifier: email } })
    .catch(() => {});
  await prisma.verificationToken.create({
    data: { identifier: email, token, expires },
  });

  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "http://localhost:3000";
  const link = `${base}/api/auth/verify?token=${encodeURIComponent(
    token
  )}&email=${encodeURIComponent(email)}`;

  try {
    await sendEmail({
      to: email,
      subject: "Verify your email",
      html: verifyEmailHtml({ link }),
    });
  } catch {
    // Don't leak provider details to the client
    return NextResponse.json(
      { ok: false, error: "Email send failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, userId });
}
