"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/** ---- Types that match the /api/butcher/orders response ---- */
type LineState = "PENDING" | "PREPARING" | "READY";

type Line = {
  id: string;
  productName: string;
  qty: number;
  unitLabel: string | null;
  basePriceCents: number;
  species: string;
  part: string | null;
  variantSizeGrams: number | null;
  prepLabels: string[];
  lineState: LineState;
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
  pickupWhen: string | null;
  createdAt: string;
  lines: Line[];
};

/** Order-level transitions the *butcher* may trigger */
const ORDER_NEXT: Record<OrderStateLiteral, OrderStateLiteral[]> = {
  PENDING: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY_FOR_DELIVERY", "CANCELLED"],
  READY_FOR_DELIVERY: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: [], // gym-admin continues from here
  AT_GYM: [],
  PICKED_UP: [],
  CANCELLED: [],
};

/** A small label helper */
function stateLabel(s: OrderStateLiteral) {
  switch (s) {
    case "PENDING":
      return "Pending";
    case "PREPARING":
      return "Preparing";
    case "READY_FOR_DELIVERY":
      return "Ready";
    case "IN_TRANSIT":
      return "In transit";
    case "AT_GYM":
      return "At gym";
    case "PICKED_UP":
      return "Picked up";
    case "CANCELLED":
      return "Cancelled";
    default:
      return s;
  }
}

export default function ButcherBoard() {
  /** ---- UI state ---- */
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [stateFilter, setStateFilter] = useState<"ALL" | OrderStateLiteral>(
    "ALL"
  );
  const [explode, setExplode] = useState(false);
  const [poll, setPoll] = useState(false);

  /** ---- Data loader ---- */
  const load = useCallback(async () => {
    try {
      setErr(null);
      setLoading(true);
      const qs =
        stateFilter === "ALL"
          ? ""
          : `?state=${encodeURIComponent(stateFilter)}`;
      const r = await fetch(`/api/butcher/orders${qs}`, { cache: "no-store" });
      if (!r.ok) throw new Error(r.statusText);
      const j = await r.json();
      setOrders(j.items || []);
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
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [poll, load]);

  /** ---- Actions ---- */
  async function moveOrder(orderId: string, next: OrderStateLiteral) {
    const r = await fetch(`/api/butcher/orders/${orderId}/state`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: next }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert(j?.error ?? r.statusText);
      return;
    }
    load();
  }

  async function moveLine(lineId: string, next: LineState) {
    const r = await fetch(`/api/butcher/orders/lines/${lineId}/state`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: next }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert(j?.error ?? r.statusText);
      return;
    }
    load();
  }

  /** ---- Group orders by state for a 4-column board ---- */
  const columns: { key: OrderStateLiteral; title: string }[] = [
    { key: "PENDING", title: "Pending" },
    { key: "PREPARING", title: "Preparing" },
    { key: "READY_FOR_DELIVERY", title: "Ready" },
    { key: "IN_TRANSIT", title: "Sent" },
  ];

  const byState = useMemo(() => {
    const map: Record<OrderStateLiteral, Order[]> = {
      PENDING: [],
      PREPARING: [],
      READY_FOR_DELIVERY: [],
      IN_TRANSIT: [],
      AT_GYM: [],
      PICKED_UP: [],
      CANCELLED: [],
    };
    for (const o of orders) map[o.state].push(o);
    return map;
  }, [orders]);

  return (
    <main style={{ maxWidth: 1200, margin: "2rem auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>Butcher Board</h1>

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>State:</span>
          <select
            className="border p-2 rounded"
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value as any)}
          >
            <option value="ALL">All</option>
            <option value="PENDING">Pending</option>
            <option value="PREPARING">Preparing</option>
            <option value="READY_FOR_DELIVERY">Ready</option>
            <option value="IN_TRANSIT">Sent</option>
          </select>
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={explode}
            onChange={(e) => setExplode(e.target.checked)}
          />
          <span>Explode orders (line-by-line)</span>
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={poll}
            onChange={(e) => setPoll(e.target.checked)}
          />
          <span>Auto-refresh</span>
        </label>

        <button className="my_button" onClick={() => load()}>
          Refresh
        </button>
      </div>

      {loading && <div>Loading…</div>}
      {err && <div style={{ color: "crimson" }}>Error: {err}</div>}

      {/* Board */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          alignItems: "start",
        }}
      >
        {columns.map((col) => (
          <section key={col.key}>
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>{col.title}</h2>

            <div style={{ display: "grid", gap: 8 }}>
              {byState[col.key].map((o) => {
                const placedAt = new Date(o.createdAt).toLocaleString();
                const allReady =
                  o.lines.length > 0 &&
                  o.lines.every((l) => l.lineState === "READY");

                return (
                  <article key={o.id} className="border p-2 rounded">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <div>
                        <b>#{o.shortCode}</b>{" "}
                        <span style={{ color: "#666" }}>
                          · {stateLabel(o.state)}
                        </span>
                      </div>
                      <div style={{ color: "#666", fontSize: 12 }}>
                        {placedAt}
                      </div>
                    </div>

                    {/* Lines */}
                    {!explode ? (
                      // Collapsed: list lines as simple bullets
                      <ul style={{ margin: "8px 0", paddingLeft: 16 }}>
                        {o.lines.map((l) => (
                          <li key={l.id}>
                            {l.qty}× {l.productName}
                            {l.variantSizeGrams
                              ? ` · ${l.variantSizeGrams}g`
                              : l.unitLabel
                              ? ` · ${l.unitLabel}`
                              : ""}
                            {l.prepLabels.length
                              ? ` · ${l.prepLabels.join(", ")}`
                              : ""}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      // Exploded: each line is its own little row w/ per-line controls
                      <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                        {o.lines.map((l) => (
                          <div
                            key={l.id}
                            className="border rounded p-2"
                            style={{
                              background:
                                l.lineState === "READY"
                                  ? "#eefbf0"
                                  : l.lineState === "PREPARING"
                                  ? "#fff7e6"
                                  : "#f6f7fb",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 8,
                                flexWrap: "wrap",
                              }}
                            >
                              <div>
                                <b>
                                  {l.qty}× {l.productName}
                                </b>
                                {l.variantSizeGrams
                                  ? ` · ${l.variantSizeGrams}g`
                                  : l.unitLabel
                                  ? ` · ${l.unitLabel}`
                                  : ""}
                                {l.prepLabels.length
                                  ? ` · ${l.prepLabels.join(", ")}`
                                  : ""}
                                <span style={{ color: "#666", marginLeft: 6 }}>
                                  ({l.lineState.toLowerCase()})
                                </span>
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  gap: 8,
                                  flexWrap: "wrap",
                                }}
                              >
                                {l.lineState === "PENDING" && (
                                  <button
                                    className="my_button"
                                    onClick={() => moveLine(l.id, "PREPARING")}
                                  >
                                    Mark Preparing
                                  </button>
                                )}
                                {l.lineState === "PREPARING" && (
                                  <>
                                    <button
                                      className="my_button"
                                      onClick={() => moveLine(l.id, "READY")}
                                    >
                                      Mark Ready
                                    </button>
                                    <button
                                      className="my_button"
                                      onClick={() => moveLine(l.id, "PENDING")}
                                    >
                                      Undo → Pending
                                    </button>
                                  </>
                                )}
                                {l.lineState === "READY" && (
                                  <button
                                    className="my_button"
                                    onClick={() => moveLine(l.id, "PREPARING")}
                                  >
                                    Undo → Preparing
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Order-level actions */}
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        marginTop: 8,
                      }}
                    >
                      {/* Show “Mark Ready” only if all lines are READY and order is PREPARING */}
                      {o.state === "PREPARING" && (
                        <button
                          className="my_button"
                          disabled={!allReady}
                          title={
                            allReady
                              ? ""
                              : "All lines must be Ready before marking order Ready"
                          }
                          onClick={() => moveOrder(o.id, "READY_FOR_DELIVERY")}
                        >
                          Mark Ready (order)
                        </button>
                      )}

                      {/* Show “Send Out” only when order is READY_FOR_DELIVERY */}
                      {o.state === "READY_FOR_DELIVERY" && (
                        <button
                          className="my_button"
                          onClick={() => moveOrder(o.id, "IN_TRANSIT")}
                        >
                          Send Out
                        </button>
                      )}

                      {/* Show “Mark Preparing” if order still pending */}
                      {o.state === "PENDING" && (
                        <button
                          className="my_button"
                          onClick={() => moveOrder(o.id, "PREPARING")}
                        >
                          Mark Preparing (order)
                        </button>
                      )}

                      {/* Allow Cancel for early states */}
                      {(o.state === "PENDING" ||
                        o.state === "PREPARING" ||
                        o.state === "READY_FOR_DELIVERY") && (
                        <button
                          className="my_button"
                          onClick={() => {
                            if (!confirm("Cancel this order?")) return;
                            moveOrder(o.id, "CANCELLED");
                          }}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
