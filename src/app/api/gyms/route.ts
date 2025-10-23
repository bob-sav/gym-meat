import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET /api/gyms -> [{ id, name }]
export async function GET() {
  const gyms = await prisma.gym.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return NextResponse.json({ items: gyms });
}
