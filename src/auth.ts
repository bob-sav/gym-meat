import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";
import type { Adapter } from "next-auth/adapters";
import { PrismaClient } from "@prisma/client";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";

const prisma = new PrismaClient();

const providers: Provider[] = [
  Credentials({
    name: "Email & Password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    authorize: async (creds) => {
      const parsed = z
        .object({ email: z.string().email(), password: z.string().min(8) })
        .safeParse(creds);
      if (!parsed.success) return null;
      const user = await prisma.user.findUnique({
        where: { email: parsed.data.email },
      });
      if (!user?.passwordHash) return null;
      const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
      return ok
        ? {
            id: user.id,
            email: user.email ?? undefined,
            name: user.name ?? undefined,
          }
        : null;
    },
  }),

  // ← include Google unconditionally (you have GOOGLE_ID/SECRET in PM2)
  Google({
    clientId: process.env.GOOGLE_ID as string,
    clientSecret: process.env.GOOGLE_SECRET as string,
  }),
];

export const {
  handlers: authHandlers,
  auth,
  signIn,
  signOut,
} = NextAuth({
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET,
  adapter: PrismaAdapter(prisma) as Adapter,
  providers,
  pages: { signIn: "/login" },
});
