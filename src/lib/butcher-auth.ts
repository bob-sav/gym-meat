import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function isButcher(email: string) {
  const u = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!u?.id) return false;

  const ba = await prisma.butcherAdmin.findUnique({
    where: { userId: u.id },
    select: { id: true },
  });
  return !!ba;
}
