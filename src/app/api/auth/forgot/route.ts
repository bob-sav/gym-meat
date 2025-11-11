export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { randomToken } from "@/lib/tokens";
import { sendEmail } from "@/lib/mails";
import { verifyEmailHtml } from "@/lib/emailTemplates"; // reuse template

const prisma = new PrismaClient();
const schema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Always respond 200 to avoid email enumeration
  const email = parsed.data.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (user) {
    const identifier = `reset:${user.id}`;
    const token = randomToken(24);
    const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    // one active reset token per user
    await prisma.verificationToken
      .deleteMany({ where: { identifier } })
      .catch(() => {});
    await prisma.verificationToken.create({
      data: { identifier, token, expires },
    });

    const base =
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.NEXTAUTH_URL ??
      process.env.AUTH_URL ??
      "http://localhost:3000";

    const link = `${base}/reset?token=${encodeURIComponent(token)}`;

    try {
      await sendEmail({
        to: email,
        subject: "Reset your password",
        html: verifyEmailHtml({ link }), // simple CTA link
      });
    } catch {
      // swallow: same outward response
    }
  }

  return NextResponse.json({ ok: true });
}
