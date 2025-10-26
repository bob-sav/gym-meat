"use client";

import { useEffect, useMemo, useState, useCallback } from "react";

type Line = {
  id: string;
  productName: string;
  qty: number;
  unitLabel: string | null;
  basePriceCents: number;
  species: string; // or narrow to your enum literals if you like
  part: string | null; // enum value as string
  variantSizeGrams: number | null; // NEW
  prepLabels: string[]; // NEW (labels extracted from optionsJson)
};

type OrderStateLiteral =
  | "PENDING"
  | "PREPARING"
  | "READY_FOR_DELIVERY"
  | "IN_TRANSIT"
  | "AT_GYM"
  | "PICKED_UP"
  | "CANCELLED";

type Order = {
  id: string;
  shortCode: string;
  state: OrderStateLiteral;
  totalCents: number;
  pickupGymName: string | null;
  pickupWhen: string | null; // serialized ISO from API
  createdAt: string; // serialized ISO from API
  lines: Line[];
};

const COLS = [
  { key: "PENDING", title: "Pending" },
  { key: "PREPARING", title: "Preparing" },
  { key: "READY_FOR_DELIVERY", title: "Ready" },
] as const;

const NEXT: Record<Order["state"], Order["state"][]> = {
  PENDING: ["PREPARING"],
  PREPARING: ["READY_FOR_DELIVERY", "CANCELLED"],
  READY_FOR_DELIVERY: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: [],
  AT_GYM: [],
  PICKED_UP: [],
  CANCELLED: [],
};

export default function ButcherBoard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [poll, setPoll] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setErr(null);
      setLoading(true);
      // For butcher we typically show three columns => call without state to get many,
      // or make three calls; here we fetch all and split client-side to keep it simple.
      const r = await fetch("/api/butcher/orders", { cache: "no-store" });
      if (!r.ok) throw new Error(r.statusText);
      const j = await r.json();
      setOrders(j.items || []);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!poll) return;
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [poll, load]);

  async function move(id: string, state: Order["state"]) {
    const r = await fetch(`/api/butcher/orders/${id}/state`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert("Move failed: " + (j?.error ?? r.statusText));
      return;
    }
    await load();
  }

  const byState = useMemo(() => {
    const m: Record<string, Order[]> = {};
    for (const k of COLS) m[k.key] = [];
    for (const o of orders) {
      if (o.state in m) m[o.state].push(o);
    }
    return m;
  }, [orders]);

  return (
    <main style={{ maxWidth: 1200, margin: "2rem auto", padding: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <h1 style={{ fontSize: 24 }}>Butcher board</h1>
        <button className="my_button" onClick={load}>
          Refresh
        </button>
        <label style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={poll}
            onChange={(e) => setPoll(e.target.checked)}
          />{" "}
          Auto-refresh
        </label>
      </div>

      {err && (
        <div style={{ color: "crimson", marginBottom: 12 }}>Error: {err}</div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
        }}
      >
        {COLS.map((col) => (
          <section
            key={col.key}
            style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}
          >
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>{col.title}</h2>
            {loading ? (
              <div>Loading…</div>
            ) : !byState[col.key].length ? (
              <div style={{ color: "#666" }}>No orders</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {byState[col.key].map((o) => (
                  <article key={o.id} className="border p-2 rounded">
                    {/* Header: code + placed-at + (optional) pickup gym */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                        alignItems: "baseline",
                      }}
                    >
                      <div>
                        <b>#{o.shortCode}</b>
                        {o.pickupGymName ? (
                          <span
                            style={{
                              marginLeft: 8,
                              color: "#666",
                              fontSize: 12,
                            }}
                          >
                            · {o.pickupGymName}
                          </span>
                        ) : null}
                      </div>
                      <div style={{ color: "#666", fontSize: 12 }}>
                        {new Date(o.createdAt).toLocaleString()}
                      </div>
                    </div>

                    {/* Lines */}
                    <ul
                      style={{
                        margin: "8px 0",
                        paddingLeft: 16,
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      {o.lines.map((l) => {
                        const partPretty = l.part
                          ? String(l.part).replace(/_/g, " ")
                          : null;
                        return (
                          <li key={l.id} style={{ listStyle: "disc" }}>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 8,
                              }}
                            >
                              <div>
                                <b>
                                  {l.qty}× {l.productName}
                                </b>
                                {l.unitLabel ? (
                                  <span> · {l.unitLabel}</span>
                                ) : null}
                              </div>
                              <div style={{ fontSize: 12, color: "#555" }}>
                                {/* quick chips: species / part / variant */}
                                <span
                                  style={{
                                    border: "1px solid #e5e7eb",
                                    borderRadius: 6,
                                    padding: "2px 6px",
                                    marginLeft: 6,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {l.species}
                                </span>
                                {partPretty ? (
                                  <span
                                    style={{
                                      border: "1px solid #e5e7eb",
                                      borderRadius: 6,
                                      padding: "2px 6px",
                                      marginLeft: 6,
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {partPretty}
                                  </span>
                                ) : null}
                                {typeof l.variantSizeGrams === "number" ? (
                                  <span
                                    style={{
                                      border: "1px solid #e5e7eb",
                                      borderRadius: 6,
                                      padding: "2px 6px",
                                      marginLeft: 6,
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {l.variantSizeGrams}g
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            {/* Prep labels (cut/cleaning, etc.) */}
                            {Array.isArray(l.prepLabels) &&
                            l.prepLabels.length > 0 ? (
                              <div
                                style={{
                                  display: "flex",
                                  gap: 6,
                                  flexWrap: "wrap",
                                  marginTop: 6,
                                }}
                              >
                                {l.prepLabels.map((lab: string, i: number) => (
                                  <span
                                    key={i}
                                    style={{
                                      fontSize: 12,
                                      border: "1px dashed #cbd5e1",
                                      borderRadius: 6,
                                      padding: "2px 6px",
                                      background: "#f8fafc",
                                    }}
                                  >
                                    {lab}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>

                    {/* Footer: quick totals + actions */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                        marginTop: 6,
                      }}
                    >
                      <div style={{ fontSize: 12, color: "#666" }}>
                        Items:{" "}
                        {o.lines.reduce(
                          (s: number, l: any) => s + (l.qty || 0),
                          0
                        )}{" "}
                        · Total: <b>{(o.totalCents / 100).toFixed(2)} €</b>
                      </div>

                      <div
                        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                      >
                        {NEXT[o.state].map((ns: any) => (
                          <button
                            key={ns}
                            className="my_button"
                            onClick={() => move(o.id, ns)}
                          >
                            {ns === "PREPARING" && "Mark Preparing"}
                            {ns === "READY_FOR_DELIVERY" && "Mark Ready"}
                            {ns === "IN_TRANSIT" && "Send Out"}
                            {ns === "CANCELLED" && "Cancel"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
