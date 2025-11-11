// src/app/api/account/verify-email-change/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function abs(req: NextRequest, path: string) {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    process.env.AUTH_URL ??
    new URL(req.url).origin;
  return new URL(path, origin);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token") ?? "";
  if (!token) return NextResponse.redirect(abs(req, "/login?verify=invalid"));

  const row = await prisma.verificationToken.findFirst({
    where: { token, identifier: { startsWith: "change:" } },
  });
  if (!row || row.expires < new Date()) {
    return NextResponse.redirect(abs(req, "/login?verify=expired"));
  }

  // identifier format: change:<userId>:<newEmail>
  const [, userId, rawEmail] = row.identifier.split(":");
  const newEmail = (rawEmail ?? "").trim().toLowerCase();
  if (!userId || !newEmail) {
    return NextResponse.redirect(abs(req, "/login?verify=invalid"));
  }

  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { email: newEmail, emailVerified: new Date() },
      }),
      prisma.verificationToken.delete({
        where: { identifier_token: { identifier: row.identifier, token } },
      }),
      // No-op with JWT sessions; harmless otherwise.
      prisma.session.deleteMany({ where: { userId } }),
    ]);
  } catch (err: any) {
    // Unique constraint on email? (P2002)
    if (err?.code === "P2002") {
      return NextResponse.redirect(abs(req, "/login?verify=email_taken"));
    }
    return NextResponse.redirect(abs(req, "/login?verify=invalid"));
  }

  return NextResponse.redirect(abs(req, "/login?verify=ok"));
}
