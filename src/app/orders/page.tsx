// src/app/orders/page.tsx
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { formatHuf, formatDateBudapest } from "@/lib/format";
import { PrismaClient } from "@prisma/client";
import Link from "next/link";

import type { CartLine, CartOption } from "@/lib/product/cart-types";
import { lineUnitTotalCents, parseUnitLabelToGrams } from "@/lib/product/price";
import CartBumpClient from "./CartBumpClient";

const prisma = new PrismaClient();

function money(amountHuf: number) {
  return formatHuf(amountHuf);
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
          variantSizeGrams: true,
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
            <div
              style={{
                padding: "8px 10px",
                border: "2px solid #fff",
                borderRadius: "var(--radius)",
              }}
              key={o.id}
            >
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
                      color: "var(--red-700)",
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
                {o.pickupWhen ? `, ${formatDateBudapest(o.pickupWhen)}` : ""}
              </div>
              <div
                style={{ color: "var(--border)", fontSize: 12, marginTop: 2 }}
              >
                Placed: {formatDateBudapest(o.createdAt)}
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
                    type StoredOpt = {
                      label: string;
                      priceDeltaCents?: number;
                      perKg?: boolean;
                      priceDeltaPerKgCents?: number; // legacy
                      groupId?: string;
                      optionId?: string;
                    };

                    const storedOptions =
                      (l.optionsJson as unknown as StoredOpt[]) ?? [];

                    const options: CartOption[] = storedOptions.map(
                      (op, idx) => {
                        const legacyPerKg =
                          typeof op.priceDeltaPerKgCents === "number" &&
                          op.priceDeltaPerKgCents !== 0;

                        const perKg =
                          typeof op.perKg === "boolean"
                            ? op.perKg
                            : legacyPerKg;

                        const priceDeltaCents =
                          typeof op.priceDeltaCents === "number"
                            ? op.priceDeltaCents
                            : legacyPerKg
                              ? (op.priceDeltaPerKgCents ?? 0)
                              : 0;

                        return {
                          groupId: op.groupId ?? `legacy-group-${idx}`,
                          optionId: op.optionId ?? `legacy-opt-${idx}`,
                          label: op.label ?? "",
                          priceDeltaCents,
                          perKg,
                        };
                      }
                    );

                    const lineForMath: CartLine = {
                      id: l.id,
                      productId: o.id,
                      name: l.productName,
                      unitLabel: l.unitLabel ?? "",
                      basePriceCents: l.basePriceCents,
                      qty: l.qty,
                      variantSizeGrams: l.variantSizeGrams ?? undefined,
                      options,
                    };

                    const unitTotalCents = lineUnitTotalCents(lineForMath);
                    const lineTotalCents = unitTotalCents * l.qty;

                    const grams =
                      l.variantSizeGrams ??
                      parseUnitLabelToGrams(l.unitLabel ?? "") ??
                      0;

                    const fixedAddCents = options
                      .filter((op) => !op.perKg)
                      .reduce((s, op) => s + op.priceDeltaCents, 0);

                    const perKgSum = options
                      .filter((op) => op.perKg)
                      .reduce((s, op) => s + op.priceDeltaCents, 0);

                    const perKgForVariantCents = Math.round(
                      perKgSum * (grams / 1000)
                    );

                    const unitSuffix = l.unitLabel ? ` · ${l.unitLabel}` : "";

                    const money = (amountHuf: number) => formatHuf(amountHuf);

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
                            <span style={{ color: "var(--border)" }}>
                              {unitSuffix}
                            </span>
                          </div>

                          <div style={{ fontSize: 12, color: "var(--border)" }}>
                            {l.species}
                            {l.part ? ` · ${l.part}` : ""}
                          </div>

                          {!!options.length && (
                            <div
                              style={{
                                fontSize: 12,
                                color: "var(--border)",
                                marginTop: 2,
                              }}
                            >
                              {options
                                .map((op) => {
                                  if (!op.priceDeltaCents) return op.label;
                                  return op.perKg
                                    ? `${op.label} (+${money(
                                        op.priceDeltaCents
                                      )} / kg)`
                                    : `${op.label} (+${money(op.priceDeltaCents)})`;
                                })
                                .join(", ")}
                            </div>
                          )}

                          {/* Breakdown per unit */}
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--order)",
                              marginTop: 4,
                            }}
                          >
                            Unit: {money(unitTotalCents)} ={" "}
                            {money(l.basePriceCents)} base
                            {fixedAddCents
                              ? ` + ${money(fixedAddCents)} opts`
                              : ""}
                            {perKgForVariantCents
                              ? ` + ${money(perKgForVariantCents)} per-kg`
                              : ""}
                          </div>
                        </div>

                        <div
                          style={{ textAlign: "right", whiteSpace: "nowrap" }}
                        >
                          {money(lineTotalCents)}
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
      <CartBumpClient />
    </main>
  );
}
