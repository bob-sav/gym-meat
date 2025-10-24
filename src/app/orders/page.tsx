// src/app/orders/page.tsx
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { PrismaClient } from "@prisma/client";
import Link from "next/link";

const prisma = new PrismaClient();

function money(cents: number) {
  return (cents / 100).toFixed(2) + " €";
}

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
      lines: {
        select: {
          id: true,
          productName: true,
          qty: true,
          unitLabel: true,
          basePriceCents: true,
          species: true,
          part: true,
          optionsJson: true, // Json column with chosen options
        },
        orderBy: { id: "asc" },
      },
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
              {/* Top row: code, status, total */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  alignItems: "baseline",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div>
                    <b>Code:</b> {o.shortCode}
                  </div>
                  <div
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontSize: 12,
                      background: "#f3f4f6",
                    }}
                  >
                    {o.state}
                  </div>
                </div>
                <div style={{ fontWeight: 600 }}>
                  Total: {money(o.totalCents)}
                </div>
              </div>

              {/* Pickup + placed */}
              <div style={{ marginTop: 6 }}>
                <b>Pickup:</b> {o.pickupGymName ?? "—"}
                {o.pickupWhen
                  ? `, ${new Date(o.pickupWhen).toLocaleString()}`
                  : ""}
              </div>
              <div style={{ color: "#666", fontSize: 12, marginTop: 2 }}>
                Placed: {new Date(o.createdAt).toLocaleString()}
              </div>

              {/* Lines */}
              {!!o.lines.length && (
                <div
                  style={{
                    marginTop: 12,
                    borderTop: "1px solid #eee",
                    paddingTop: 10,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  {o.lines.map((l) => {
                    const options =
                      (l.optionsJson as unknown as {
                        label: string;
                        priceDeltaCents?: number;
                      }[]) ?? [];
                    const unit = l.unitLabel ? ` · ${l.unitLabel}` : "";
                    const lineTotal = l.basePriceCents * l.qty; // base only; options are additive already in pricing

                    return (
                      <div
                        key={l.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          gap: 8,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 500 }}>
                            {l.qty} × {l.productName}
                            <span style={{ color: "#666" }}>{unit}</span>
                          </div>
                          <div style={{ fontSize: 12, color: "#666" }}>
                            {l.species}
                            {l.part ? ` · ${l.part}` : ""}
                          </div>
                          {!!options.length && (
                            <div
                              style={{
                                fontSize: 12,
                                color: "#444",
                                marginTop: 2,
                              }}
                            >
                              {options
                                .map(
                                  (o) =>
                                    `${o.label}${
                                      o.priceDeltaCents
                                        ? ` (+${money(o.priceDeltaCents)})`
                                        : ""
                                    }`
                                )
                                .join(", ")}
                            </div>
                          )}
                        </div>
                        <div
                          style={{ textAlign: "right", whiteSpace: "nowrap" }}
                        >
                          {money(lineTotal)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
