// src/lib/roles.ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export type UserRoles = {
  isGymAdmin: boolean;
  gymIds: string[];
  isButcher: boolean;
  isButcherSettler: boolean;
};

// src/lib/roles.ts
export function isSiteAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const allow = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(email.toLowerCase());
}

export async function getUserRoles(
  email: string | null | undefined
): Promise<UserRoles> {
  if (!email)
    return {
      isGymAdmin: false,
      gymIds: [],
      isButcher: false,
      isButcherSettler: false,
    };

  const [gymAdmins, butcherAdmin] = await Promise.all([
    prisma.gymAdmin.findMany({
      where: { user: { email } },
      select: { gymId: true },
    }),
    prisma.butcherAdmin.findFirst({
      where: { user: { email } },
      select: { role: true },
    }),
  ]);

  const gymIds = gymAdmins.map((g) => g.gymId);
  const isGymAdmin = gymIds.length > 0;
  const isButcher = !!butcherAdmin;
  const isButcherSettler = butcherAdmin?.role === "SETTLEMENT";

  return { isGymAdmin, gymIds, isButcher, isButcherSettler };
}
