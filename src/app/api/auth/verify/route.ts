// src/app/api/auth/verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const originFromEnv = () =>
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.NEXTAUTH_URL ??
  process.env.AUTH_URL ??
  process.env.APP_URL ??
  null;

const abs = (req: NextRequest, path: string) =>
  new URL(path, originFromEnv() ?? req.url);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token") ?? "";
  const email = searchParams.get("email") ?? "";

  if (!token || !email) {
    return NextResponse.redirect(abs(req, "/login?verify=invalid"));
  }

  const row = await prisma.verificationToken.findUnique({
    where: { identifier_token: { identifier: email, token } },
  });
  if (!row || row.expires < new Date()) {
    return NextResponse.redirect(abs(req, "/login?verify=expired"));
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { email },
      data: { emailVerified: new Date() },
    }),
    prisma.verificationToken.delete({
      where: { identifier_token: { identifier: email, token } },
    }),
  ]);

  return NextResponse.redirect(abs(req, "/login?verify=ok"));
}
