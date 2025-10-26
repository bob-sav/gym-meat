// src/app/gym-admin/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Line = {
  id: string;
  productName: string;
  qty: number;
  unitLabel: string | null;
  basePriceCents: number;
  species: string;
  part: string | null;
};

type Order = {
  id: string;
  shortCode: string;
  state:
    | "IN_TRANSIT"
    | "AT_GYM"
    | "PICKED_UP"
    | "CANCELLED"
    | "PENDING"
    | "PREPARING"
    | "READY_FOR_DELIVERY";
  totalCents: number;
  pickupGymName: string | null;
  pickupWhen: string | null;
  createdAt: string;
  user?: { name: string | null; email: string | null };
  lines: Line[];
};

const CAN_DO = {
  IN_TRANSIT: ["AT_GYM"], // can mark arrival
  AT_GYM: ["PICKED_UP", "CANCELLED"], // can close out
} as const;

export default function GymAdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<string>(""); // "", IN_TRANSIT, AT_GYM, PICKED_UP, CANCELLED
  const [poll, setPoll] = useState<boolean>(true);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const qs = stateFilter ? `?state=${encodeURIComponent(stateFilter)}` : "";
      const r = await fetch(`/api/gym/orders${qs}`, { cache: "no-store" });
      const j = await r.json();
      setOrders(j.items ?? []);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [stateFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!poll) return;
    const id = setInterval(() => load(), 10_000);
    return () => clearInterval(id);
  }, [poll, load]);

  async function move(
    orderId: string,
    next: "IN_TRANSIT" | "AT_GYM" | "PICKED_UP" | "CANCELLED"
  ) {
    const r = await fetch(`/api/gym/orders/${orderId}/state`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: next }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert(j?.error ?? r.statusText);
      return;
    }
    await load();
  }

  const grouped = useMemo(() => {
    const g = new Map<string, Order[]>();
    for (const o of orders) {
      const k = o.state;
      if (!g.has(k)) g.set(k, []);
      g.get(k)!.push(o);
    }
    return g;
  }, [orders]);

  return (
    <main style={{ maxWidth: 1100, margin: "2rem auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>Gym Admin — Orders</h1>

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <label>
          <span style={{ marginRight: 6 }}>Filter:</span>
          <select
            className="border p-2 rounded"
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
          >
            <option value="">All</option>
            <option>IN_TRANSIT</option>
            <option>AT_GYM</option>
            <option>PICKED_UP</option>
            <option>CANCELLED</option>
          </select>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={poll}
            onChange={(e) => setPoll(e.target.checked)}
          />
          <span>Auto-refresh (10s)</span>
        </label>
        <button className="my_button" onClick={load}>
          Refresh
        </button>
      </div>

      {loading && <div>Loading…</div>}
      {err && <div style={{ color: "crimson" }}>Error: {err}</div>}
      {!loading && !orders.length && <div>No orders found.</div>}

      {/* Column layout: left = active states, right = closed */}
      {!!orders.length && (
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        >
          <section>
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>Active</h2>
            {["IN_TRANSIT", "AT_GYM"].map((st) => (
              <div key={st} style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>{st}</div>
                <div style={{ display: "grid", gap: 10 }}>
                  {(grouped.get(st) ?? []).map((o) => (
                    <div key={o.id} className="border p-3 rounded">
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <div>
                          <div>
                            <b>Code:</b>{" "}
                            <span style={{ fontFamily: "monospace" }}>
                              {o.shortCode}
                            </span>
                          </div>
                          <div style={{ color: "#666", fontSize: 12 }}>
                            Placed {new Date(o.createdAt).toLocaleString()}
                          </div>
                          {o.pickupWhen && (
                            <div style={{ color: "#666", fontSize: 12 }}>
                              Arrived {new Date(o.pickupWhen).toLocaleString()}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div>
                            <b>Total:</b> {(o.totalCents / 100).toFixed(2)} €
                          </div>
                          <div style={{ color: "#666" }}>
                            {o.pickupGymName ?? "—"}
                          </div>
                        </div>
                      </div>

                      <div style={{ marginTop: 8, fontSize: 14 }}>
                        {o.lines.map((l) => (
                          <div
                            key={l.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                            }}
                          >
                            <span>
                              {l.qty}× {l.productName}
                              {l.unitLabel ? ` · ${l.unitLabel}` : ""}
                            </span>
                            <span>
                              {((l.basePriceCents * l.qty) / 100).toFixed(2)} €
                            </span>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        {o.state === "IN_TRANSIT" && (
                          <button
                            className="my_button"
                            onClick={() => move(o.id, "AT_GYM")}
                          >
                            Mark AT_GYM
                          </button>
                        )}
                        {o.state === "AT_GYM" && (
                          <>
                            <button
                              className="my_button"
                              onClick={() => move(o.id, "PICKED_UP")}
                            >
                              Mark PICKED_UP
                            </button>
                            <button
                              className="my_button"
                              style={{ background: "#ec1818ff" }}
                              onClick={() => {
                                if (confirm("Cancel this order?"))
                                  move(o.id, "CANCELLED");
                              }}
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section>
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>Closed</h2>
            {["PICKED_UP", "CANCELLED"].map((st) => (
              <div key={st} style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>{st}</div>
                <div style={{ display: "grid", gap: 10 }}>
                  {(grouped.get(st) ?? []).map((o) => (
                    <div
                      key={o.id}
                      className="border p-3 rounded"
                      style={{ opacity: 0.9 }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <div>
                          <div>
                            <b>Code:</b>{" "}
                            <span style={{ fontFamily: "monospace" }}>
                              {o.shortCode}
                            </span>
                          </div>
                          <div style={{ color: "#666", fontSize: 12 }}>
                            Placed {new Date(o.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div>
                            <b>Total:</b> {(o.totalCents / 100).toFixed(2)} €
                          </div>
                          <div style={{ color: "#666" }}>
                            {o.pickupGymName ?? "—"}
                          </div>
                        </div>
                      </div>
                      <div style={{ marginTop: 8, fontSize: 14 }}>
                        {o.lines.map((l) => (
                          <div
                            key={l.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                            }}
                          >
                            <span>
                              {l.qty}× {l.productName}
                              {l.unitLabel ? ` · ${l.unitLabel}` : ""}
                            </span>
                            <span>
                              {((l.basePriceCents * l.qty) / 100).toFixed(2)} €
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        </div>
      )}
    </main>
  );
}
