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
  prepLabels: string[];
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

// Which next states a gym-admin may set
const CAN_GO: Record<OrderState, OrderState[]> = {
  IN_TRANSIT: ["AT_GYM"],
  AT_GYM: ["PICKED_UP", "CANCELLED"],
  // others are not changeable from gym-admin UI
  PENDING: [],
  PREPARING: [],
  READY_FOR_DELIVERY: [],
  PICKED_UP: [],
  CANCELLED: [],
};

const ALL_STATE_ORDER: OrderState[] = [
  "IN_TRANSIT",
  "AT_GYM",
  "PICKED_UP",
  "CANCELLED",
];

export default function GymAdminPage() {
  // Filters
  const [states, setStates] = useState<OrderState[]>(["IN_TRANSIT", "AT_GYM"]);
  const [poll, setPoll] = useState(true);
  const [search, setSearch] = useState("");

  // Data
  const [items, setItems] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Build query string from selected states
  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    for (const s of states) sp.append("state", s);
    return `?${sp.toString()}`;
  }, [states]);

  const load = useCallback(async () => {
    try {
      setErr(null);
      setLoading(true);
      const r = await fetch(`/api/gym/orders${queryString}`, {
        cache: "no-store",
      });
      if (!r.ok) throw new Error(r.statusText);
      const j = await r.json();
      setItems(j.items || []);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!poll) return;
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [poll, load]);

  // Client-side search filter (code/product/prep)
  const filtered = useMemo(() => {
    if (!search) return items;
    const s = search.toLowerCase();
    return items.filter(
      (o) =>
        o.shortCode.includes(s) ||
        o.lines.some(
          (l) =>
            l.productName.toLowerCase().includes(s) ||
            (l.prepLabels || []).some((p) => p.toLowerCase().includes(s))
        )
    );
  }, [items, search]);

  // Group by state for columns (only render columns the user selected)
  const byState = useMemo(() => {
    const m = new Map<OrderState, Order[]>();
    for (const st of ALL_STATE_ORDER) m.set(st, []);
    for (const o of filtered) {
      const arr = m.get(o.state);
      if (arr) arr.push(o);
    }
    return m;
  }, [filtered]);

  // Toggle a state chip in the toolbar
  function toggleState(s: OrderState) {
    setStates((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  async function move(orderId: string, next: OrderState) {
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

  const visibleStates = ALL_STATE_ORDER.filter((s) => states.includes(s));

  return (
    <main style={{ maxWidth: 1200, margin: "2rem auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>Gym Admin</h1>

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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {ALL_STATE_ORDER.map((s) => {
            const on = states.includes(s);
            return (
              <button
                key={s}
                className="my_button"
                style={{ background: on ? "#ec1818ff" : "#2306ff" }}
                onClick={() => toggleState(s)}
                title={`Toggle ${s}`}
              >
                {s.replaceAll("_", " ")}
              </button>
            );
          })}
        </div>

        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={poll}
            onChange={(e) => setPoll(e.target.checked)}
          />
          Auto-refresh
        </label>

        <input
          placeholder="Search code / product / prep"
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

      {/* Columns */}
      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: `repeat(${
            visibleStates.length || 1
          }, minmax(0,1fr))`,
        }}
      >
        {visibleStates.map((stateKey) => {
          const list = byState.get(stateKey) ?? [];
          return (
            <section key={stateKey} className="border rounded p-2">
              <h2 style={{ fontSize: 18, marginBottom: 8 }}>
                {stateKey.replaceAll("_", " ")}{" "}
                <span style={{ color: "#666" }}>({list.length})</span>
              </h2>

              <div style={{ display: "grid", gap: 8 }}>
                {list.map((o) => (
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
                        {o.pickupGymName ? `· ${o.pickupGymName}` : ""}
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
                          {!!l.prepLabels?.length
                            ? ` · Prep: ${l.prepLabels.join(", ")}`
                            : ""}
                        </li>
                      ))}
                    </ul>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {(CAN_GO[o.state] || []).map((ns) => (
                        <button
                          key={ns}
                          className="my_button"
                          onClick={() => move(o.id, ns)}
                        >
                          {ns === "AT_GYM" && "Mark Arrived"}
                          {ns === "PICKED_UP" && "Mark Picked Up"}
                          {ns === "CANCELLED" && "Cancel"}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
