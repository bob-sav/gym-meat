import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function getButcherAdmin(email: string) {
  if (!email) return null;
  return prisma.butcherAdmin.findFirst({
    where: { user: { email } },
    select: { id: true, role: true, userId: true },
  });
}

export async function isButcher(email: string) {
  const admin = await getButcherAdmin(email);
  return !!admin;
}

export async function isButcherSettler(email: string) {
  const admin = await getButcherAdmin(email);
  return admin?.role === "SETTLEMENT";
}
