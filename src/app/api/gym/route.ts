import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";

const prisma = new PrismaClient();

const createSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  notes: z.string().optional(),
  active: z.boolean().optional(),
});

// GET /api/gym  -> full list for backoffice (requires login)
export async function GET() {
  const session = await auth();
  if (!session?.user?.email)
    return NextResponse.json({ items: [] }, { status: 401 });

  // TODO: tighten to only global admins if/when you add that
  const gyms = await prisma.gym.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      admins: {
        include: { user: { select: { id: true, email: true, name: true } } },
      },
    },
  });

  return NextResponse.json({
    items: gyms.map((g) => ({
      id: g.id,
      name: g.name,
      address: g.address,
      notes: g.notes,
      active: g.active,
      admins: g.admins.map((a) => ({
        id: a.id,
        userId: a.userId,
        userEmail: a.user?.email ?? null,
        userName: a.user?.name ?? null,
      })),
    })),
  });
}

// POST /api/gym -> create gym (requires login)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const d = parsed.data;
  const gym = await prisma.gym.create({
    data: {
      name: d.name,
      address: d.address ?? null,
      notes: d.notes ?? null,
      active: d.active ?? true,
    },
  });

  return NextResponse.json({ gym }, { status: 201 });
}
