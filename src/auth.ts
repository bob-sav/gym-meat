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
        select: {
          id: true,
          email: true,
          name: true,
          passwordHash: true, // <- keep using passwordHash
          emailVerified: true, // <- we need this for the guard
        },
      });

      if (!user?.passwordHash) return null;

      const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
      if (!ok) return null;

      // 🔒 Block credentials login until email is verified
      if (!user.emailVerified) {
        // Throwing signals a credentials error; handle on /login via ?error=
        throw new Error("Email not verified");
      }

      return {
        id: user.id,
        email: user.email ?? undefined,
        name: user.name ?? undefined,
      };
    },
  }),

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
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  // let NextAuth manage cookie names; no manual cookies override
  secret: process.env.AUTH_SECRET,
  adapter: PrismaAdapter(prisma) as Adapter,
  providers,
  pages: { signIn: "/login" },

  // ✅ Add these callbacks
  callbacks: {
    async jwt({ token, user }) {
      // When user signs in, copy the DB id to the token
      if (user?.id) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      // Expose id on the session so routes can use session.user.id
      if (session.user && token?.id) {
        (session.user as any).id = token.id as string;
      } else if (session.user && token?.sub) {
        (session.user as any).id = token.sub as string; // fallback
      }
      return session;
    },
  },

  trustHost: true,
});
