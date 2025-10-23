// src/app/orders/page.tsx
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { PrismaClient } from "@prisma/client";
import Link from "next/link";

const prisma = new PrismaClient();

export default async function OrdersPage() {
  const session = await auth();
  if (!session?.user?.email) {
    return (
      <main style={{ maxWidth: 800, margin: "2rem auto", padding: 16 }}>
        <h1 style={{ fontSize: 24, marginBottom: 12 }}>Your Orders</h1>
        <p>
          Please <Link href="/login">log in</Link> to see your orders.
        </p>
      </main>
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, name: true },
  });
  if (!user) {
    return (
      <main style={{ maxWidth: 800, margin: "2rem auto", padding: 16 }}>
        <h1 style={{ fontSize: 24, marginBottom: 12 }}>Your Orders</h1>
        <p>No orders yet.</p>
      </main>
    );
  }

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      shortCode: true,
      state: true,
      totalCents: true,
      pickupGymName: true,
      pickupWhen: true,
      createdAt: true,
    },
  });

  return (
    <main style={{ maxWidth: 900, margin: "2rem auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>
        Your Orders{user.name ? `, ${user.name}` : ""}
      </h1>
      {!orders.length ? (
        <p>No orders yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {orders.map((o) => (
            <div key={o.id} className="border p-3 rounded">
              <div>
                <b>Code:</b> {o.shortCode}
              </div>
              <div>
                <b>Status:</b> {o.state}
              </div>
              <div>
                <b>Total:</b> {(o.totalCents / 100).toFixed(2)} €
              </div>
              <div>
                <b>Pickup:</b> {o.pickupGymName ?? "—"}
                {o.pickupWhen
                  ? `, ${new Date(o.pickupWhen).toLocaleString()}`
                  : ""}
              </div>
              <div style={{ color: "#666", fontSize: 12 }}>
                Placed: {new Date(o.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
