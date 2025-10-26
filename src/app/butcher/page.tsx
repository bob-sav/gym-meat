"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/** --- Types that mirror the API shape --- */
type OrderStateLiteral =
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
  prepLabels: string[]; // derived in API route
};

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

/** A “flattened” card when exploding orders into individual work items */
type LineCard = {
  kind: "line";
  id: string; // line id
  orderId: string;
  shortCode: string;
  createdAt: string;
  state: OrderStateLiteral;

  productName: string;
  qty: number;
  unitLabel: string | null;
  variantSizeGrams: number | null;
  prepLabels: string[];
  species: string;
  part: string | null;

  index: number; // 1-based index within order (only when exploded)
  count: number; // total lines in that order
};

const NEXT: Record<OrderStateLiteral, OrderStateLiteral[]> = {
  PENDING: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY_FOR_DELIVERY", "CANCELLED"],
  READY_FOR_DELIVERY: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: ["AT_GYM"],
  AT_GYM: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: [],
  CANCELLED: [],
} as const;

const COLS: { key: OrderStateLiteral; title: string }[] = [
  { key: "PENDING", title: "Pending" },
  { key: "PREPARING", title: "Preparing" },
  { key: "READY_FOR_DELIVERY", title: "Ready" },
];

/** --- Helpers --- */
function makeLineCards(o: Order): LineCard[] {
  const count = o.lines.length || 1;
  return o.lines.map((l, i) => ({
    kind: "line" as const,
    id: l.id,
    orderId: o.id,
    shortCode: o.shortCode,
    createdAt: o.createdAt,
    state: o.state,

    productName: l.productName,
    qty: l.qty,
    unitLabel: l.unitLabel,
    variantSizeGrams: l.variantSizeGrams ?? null,
    prepLabels: l.prepLabels ?? [],
    species: l.species,
    part: l.part,

    index: i + 1,
    count,
  }));
}

function passesFilter(item: Order | LineCard, q: string) {
  if (!q) return true;
  const hay =
    "kind" in item
      ? [
          item.shortCode,
          item.productName,
          item.species,
          item.part ?? "",
          ...(item.prepLabels ?? []),
        ].join(" ")
      : [
          item.shortCode,
          ...item.lines.map((l) => l.productName),
          ...item.lines.map((l) => l.species),
          ...item.lines.map((l) => l.part ?? ""),
          ...item.lines.flatMap((l) => l.prepLabels ?? []),
        ].join(" ");
  return hay.toLowerCase().includes(q.toLowerCase());
}

type SortBy = "created" | "code" | "species" | "prep";

function sortItems<T extends Order | LineCard>(arr: T[], sortBy: SortBy): T[] {
  const copy = [...arr];
  copy.sort((a, b) => {
    if (sortBy === "created") {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    if (sortBy === "code") {
      const ca = ("shortCode" in a ? a.shortCode : "") || "";
      const cb = ("shortCode" in b ? b.shortCode : "") || "";
      return ca.localeCompare(cb);
    }
    if (sortBy === "species") {
      const sa = "kind" in a ? a.species : a.lines[0]?.species ?? ""; // coarse: first line species
      const sb = "kind" in b ? b.species : b.lines[0]?.species ?? "";
      return sa.localeCompare(sb);
    }
    if (sortBy === "prep") {
      const pa =
        "kind" in a
          ? a.prepLabels.join(",")
          : a.lines.flatMap((l) => l.prepLabels).join(",");
      const pb =
        "kind" in b
          ? b.prepLabels.join(",")
          : b.lines.flatMap((l) => l.prepLabels).join(",");
      return pa.localeCompare(pb);
    }
    return 0;
  });
  return copy;
}

/** --- Page --- */
export default function ButcherPage() {
  const [items, setItems] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [stateFilter, setStateFilter] = useState<OrderStateLiteral | "ALL">(
    "PENDING"
  );
  const [explodeLines, setExplodeLines] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("created");
  const [q, setQ] = useState("");
  const [poll, setPoll] = useState(true);

  const load = useCallback(async () => {
    try {
      setErr(null);
      setLoading(true);
      const url =
        stateFilter === "ALL"
          ? "/api/butcher/orders"
          : `/api/butcher/orders?state=${encodeURIComponent(stateFilter)}`;
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error(r.statusText);
      const j = await r.json();
      setItems(j.items || []);
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

  async function move(orderId: string, next: OrderStateLiteral) {
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

  // Split orders by column state (only the three butcher columns)
  const byState = useMemo(() => {
    const m: Record<OrderStateLiteral, Order[]> = {
      PENDING: [],
      PREPARING: [],
      READY_FOR_DELIVERY: [],
      IN_TRANSIT: [],
      AT_GYM: [],
      PICKED_UP: [],
      CANCELLED: [],
    };
    for (const o of items) m[o.state as OrderStateLiteral]?.push(o);
    return m;
  }, [items]);

  // Build the list to render for a given column
  function getViewItems(colKey: OrderStateLiteral): (Order | LineCard)[] {
    const base = byState[colKey] ?? [];
    const exploded = explodeLines ? base.flatMap(makeLineCards) : base;
    const filtered = exploded.filter((it) => passesFilter(it as any, q));
    return sortItems(filtered as any[], sortBy);
  }

  return (
    <main style={{ maxWidth: 1200, margin: "2rem auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>Butcher dashboard</h1>

      {/* Toolbar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr auto",
          gap: 8,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <label>
          <div style={{ fontSize: 12, color: "#666" }}>State</div>
          <select
            className="border p-2 rounded w-full"
            value={stateFilter}
            onChange={(e) =>
              setStateFilter(e.target.value as OrderStateLiteral | "ALL")
            }
          >
            <option value="ALL">All</option>
            <option value="PENDING">Pending</option>
            <option value="PREPARING">Preparing</option>
            <option value="READY_FOR_DELIVERY">Ready</option>
          </select>
        </label>

        <label>
          <div style={{ fontSize: 12, color: "#666" }}>Sort</div>
          <select
            className="border p-2 rounded w-full"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
          >
            <option value="created">By time</option>
            <option value="code">By code</option>
            <option value="species">By species</option>
            <option value="prep">By prep</option>
          </select>
        </label>

        <label>
          <div style={{ fontSize: 12, color: "#666" }}>Search</div>
          <input
            className="border p-2 rounded w-full"
            placeholder="code, product, species, prep…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={explodeLines}
            onChange={(e) => setExplodeLines(e.target.checked)}
          />
          Explode orders to lines
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={poll}
            onChange={(e) => setPoll(e.target.checked)}
          />
          Auto refresh
        </label>
      </div>

      {loading && <div>Loading…</div>}
      {err && <div style={{ color: "crimson" }}>Error: {err}</div>}

      {/* Columns */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          alignItems: "start",
        }}
      >
        {COLS.map((col) => (
          <section key={col.key} className="border p-2 rounded">
            <h2 style={{ fontWeight: 600, marginBottom: 8 }}>
              {col.title} ({byState[col.key].length})
            </h2>

            <div style={{ display: "grid", gap: 8 }}>
              {getViewItems(col.key).map((item) => {
                const state = (item as any).state as OrderStateLiteral;
                const actions = NEXT[state];

                // Render either a whole order card or a single line card
                const isLine = (item as any).kind === "line";

                if (isLine) {
                  const l = item as LineCard;
                  return (
                    <article key={l.id} className="border p-2 rounded">
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <div>
                          <b>#{l.shortCode}</b>{" "}
                          <span style={{ color: "#666" }}>
                            ({l.index} of {l.count})
                          </span>
                        </div>
                        <div style={{ color: "#666", fontSize: 12 }}>
                          {new Date(l.createdAt).toLocaleString()}
                        </div>
                      </div>

                      <ul style={{ margin: "8px 0", paddingLeft: 16 }}>
                        <li>
                          {l.qty}× {l.productName}
                          {l.unitLabel ? ` · ${l.unitLabel}` : ""}
                          {l.variantSizeGrams
                            ? ` · ${l.variantSizeGrams}g`
                            : ""}
                          {!!l.prepLabels?.length && (
                            <div style={{ color: "#555", marginTop: 4 }}>
                              Prep: {l.prepLabels.join(", ")}
                            </div>
                          )}
                        </li>
                      </ul>

                      <div
                        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                      >
                        {actions.map((ns) => (
                          <button
                            key={ns}
                            className="my_button"
                            onClick={() => move(l.orderId, ns)}
                          >
                            {ns === "PREPARING" && "Mark Preparing"}
                            {ns === "READY_FOR_DELIVERY" && "Mark Ready"}
                            {ns === "IN_TRANSIT" && "Send Out"}
                            {ns === "CANCELLED" && "Cancel"}
                          </button>
                        ))}
                      </div>
                    </article>
                  );
                }

                const o = item as Order;
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
                        <b>#{o.shortCode}</b>
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
                          {!!l.prepLabels?.length && (
                            <div style={{ color: "#555", marginTop: 4 }}>
                              Prep: {l.prepLabels.join(", ")}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {actions.map((ns) => (
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
