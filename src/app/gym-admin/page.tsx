"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type OrderState =
  | "PENDING"
  | "PREPARING"
  | "READY_FOR_DELIVERY"
  | "IN_TRANSIT"
  | "AT_GYM"
  | "PICKED_UP"
  | "CANCELLED";

type Line = {
  id: string;
  productName: string;
  qty: number;
  unitLabel: string | null;
  basePriceCents: number;
  species: string;
  part: string | null;
  variantSizeGrams: number | null;
  optionsJson?: any;
};

type Order = {
  id: string;
  shortCode: string;
  state: OrderState;
  totalCents: number;
  pickupGymName: string | null;
  pickupWhen: string | null;
  createdAt: string;
  lines: Line[];
};

const COLS: { key: OrderState; title: string }[] = [
  { key: "IN_TRANSIT", title: "On the Way" },
  { key: "AT_GYM", title: "At Gym" },
];

export default function GymAdminPage() {
  const [items, setItems] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [showCompleted, setShowCompleted] = useState(false);
  const [poll, setPoll] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setErr(null);

      const qs = showCompleted ? "?state=PICKED_UP" : "";
      const r = await fetch(`/api/gym/orders${qs}`, { cache: "no-store" });
      if (!r.ok) throw new Error(r.statusText);
      const j = await r.json();
      setItems(j.items || []);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [showCompleted]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!poll) return;
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [poll, load]);

  const filtered = useMemo(() => {
    let arr = items.slice();
    if (search) {
      const s = search.toLowerCase();
      arr = arr.filter(
        (o) =>
          o.shortCode.includes(s) ||
          o.lines.some((l) => l.productName.toLowerCase().includes(s))
      );
    }
    return arr;
  }, [items, search]);

  const byState = useMemo(() => {
    const groups: Record<OrderState, Order[]> = {
      PENDING: [],
      PREPARING: [],
      READY_FOR_DELIVERY: [],
      IN_TRANSIT: [],
      AT_GYM: [],
      PICKED_UP: [],
      CANCELLED: [],
    };
    for (const o of filtered) groups[o.state].push(o);
    return groups;
  }, [filtered]);

  async function move(
    orderId: string,
    next: "AT_GYM" | "PICKED_UP" | "CANCELLED"
  ) {
    try {
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
    } catch (e: any) {
      alert(e?.message ?? String(e));
    }
  }

  return (
    <main style={{ maxWidth: 1200, margin: "2rem auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>Gym Admin · Orders</h1>

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
          />
          Show Completed
        </label>

        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={poll}
            onChange={(e) => setPoll(e.target.checked)}
          />
          Auto-refresh
        </label>

        <input
          placeholder="Search code / product"
          className="border p-2 rounded"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 260 }}
        />

        <button className="my_button" onClick={load}>
          Refresh
        </button>
      </div>

      {err && <div style={{ color: "crimson" }}>Error: {err}</div>}
      {loading && <div>Loading…</div>}

      {/* Two main columns */}
      {!showCompleted ? (
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(2, minmax(0,1fr))",
          }}
        >
          {COLS.map((col) => (
            <section key={col.key} className="border rounded p-2">
              <h2 style={{ fontSize: 18, marginBottom: 8 }}>
                {col.title}{" "}
                <span style={{ color: "#666" }}>
                  ({byState[col.key].length})
                </span>
              </h2>

              <div style={{ display: "grid", gap: 8 }}>
                {byState[col.key].map((o) => (
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
                          · {o.pickupGymName ?? "—"}
                        </span>
                      </div>
                      <div style={{ color: "#666", fontSize: 12 }}>
                        {new Date(o.createdAt).toLocaleString()}
                      </div>
                    </div>

                    <ul style={{ margin: "8px 0", paddingLeft: 16 }}>
                      {o.lines.map((l) => (
                        <li key={l.id}>
                          {l.qty}× {l.productName}
                          {l.unitLabel ? ` · ${l.unitLabel}` : ""}
                          {l.variantSizeGrams
                            ? ` · ${l.variantSizeGrams}g`
                            : ""}
                          {l.part ? ` · ${l.part}` : ""}
                        </li>
                      ))}
                    </ul>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {o.state === "IN_TRANSIT" && (
                        <button
                          className="my_button"
                          onClick={() => move(o.id, "AT_GYM")}
                        >
                          Mark Arrived
                        </button>
                      )}
                      {o.state === "AT_GYM" && (
                        <>
                          <button
                            className="my_button"
                            onClick={() => move(o.id, "PICKED_UP")}
                          >
                            Picked Up
                          </button>
                          <button
                            className="my_button"
                            onClick={() => move(o.id, "CANCELLED")}
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        // Completed list
        <section className="border rounded p-2">
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>
            Completed (Picked Up)
          </h2>
          <div style={{ display: "grid", gap: 8 }}>
            {byState.PICKED_UP.map((o) => (
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
                      · {o.pickupGymName ?? "—"}
                    </span>
                  </div>
                  <div style={{ color: "#666", fontSize: 12 }}>
                    {new Date(o.createdAt).toLocaleString()}
                  </div>
                </div>
                <ul style={{ margin: "8px 0", paddingLeft: 16 }}>
                  {o.lines.map((l) => (
                    <li key={l.id}>
                      {l.qty}× {l.productName}
                      {l.unitLabel ? ` · ${l.unitLabel}` : ""}
                      {l.variantSizeGrams ? ` · ${l.variantSizeGrams}g` : ""}
                      {l.part ? ` · ${l.part}` : ""}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
