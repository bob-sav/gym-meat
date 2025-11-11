import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

const schema = z.object({
  // allow single email or a list
  email: z.string().email().optional(),
  emails: z.array(z.string().email()).optional(),
});

export async function POST(req: NextRequest) {
  // simple header guard
  if (req.headers.get("x-admin-token") !== process.env.ADMIN_API_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success || (!parsed.data.email && !parsed.data.emails)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const emails = parsed.data.emails ?? [parsed.data.email!];

  const results: Array<{ email: string; deleted: boolean }> = [];

  for (const email of emails) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!user) {
      results.push({ email, deleted: false });
      continue;
    }

    // clean all related rows; adjust model names if yours differ
    await prisma.$transaction([
      prisma.session.deleteMany({ where: { userId: user.id } }),
      prisma.account.deleteMany({ where: { userId: user.id } }),
      prisma.verificationToken.deleteMany({ where: { identifier: email } }),
      prisma.user.delete({ where: { id: user.id } }),
    ]);

    results.push({ email, deleted: true });
  }

  return NextResponse.json({ ok: true, results });
}
