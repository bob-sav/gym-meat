import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ items: [] }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope");

  if (scope === "my") {
    // only gyms where current user is admin
    const gyms = await prisma.gym.findMany({
      where: { admins: { some: { user: { email: session.user.email } } } },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        address: true,
        notes: true,
        active: true,
      },
    });
    return NextResponse.json({ items: gyms });
  }

  // existing full backoffice list (unchanged)
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
