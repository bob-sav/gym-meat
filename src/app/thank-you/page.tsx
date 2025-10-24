// src/app/thank-you/page.tsx
export const dynamic = "force-dynamic";

import Link from "next/link";
import { auth } from "@/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: { code?: string; gym?: string };
}) {
  // 1) Keep supporting code/gym via URL (legacy)
  let code = searchParams?.code ?? "";
  let gym = searchParams?.gym ?? "";

  // 2) If not provided, load latest order for the current user
  if (!code) {
    const session = await auth();
    if (session?.user?.email) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      });

      if (user) {
        const last = await prisma.order.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          select: {
            shortCode: true,
            pickupGymName: true,
            createdAt: true,
          },
        });
        if (last) {
          code = last.shortCode;
          gym = last.pickupGymName ?? "";
        }
      }
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "2rem auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Thank you!</h1>

      {code ? (
        <>
          <p>Your order has been placed.</p>

          <p style={{ marginTop: 12 }}>
            <b>Pickup code:</b>{" "}
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 24,
                padding: "4px 8px",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                display: "inline-block",
              }}
            >
              {code}
            </span>
          </p>

          {gym && (
            <p style={{ marginTop: 8 }}>
              <b>Pickup location:</b> {gym}
            </p>
          )}

          <p style={{ marginTop: 16 }}>
            Show this code at the gym to receive your order.
          </p>

          <div style={{ marginTop: 24, display: "flex", gap: 8 }}>
            <Link className="my_button" href="/orders">
              View my orders
            </Link>
            <Link className="my_button" href="/products">
              Back to products
            </Link>
          </div>
        </>
      ) : (
        <p>
          No recent order found. <Link href="/products">Browse products</Link>{" "}
          or <Link href="/orders">see your orders</Link>.
        </p>
      )}
    </main>
  );
}
