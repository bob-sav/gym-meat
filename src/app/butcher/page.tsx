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

type LineCard = {
  kind: "line";
  id: string; // line id
  orderId: string; // parent order id
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

  index: number;
  count: number;
};

type OrderCard = Order;

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

type SortKey =
  | "createdAtDesc"
  | "createdAtAsc"
  | "shortCode"
  | "species"
  | "prep";

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
  const [explodeLines, setExplodeLines] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("createdAtAsc");
  const [q, setQ] = useState(""); // quick text filter (code/species/part/product/prep)

  function makeLineCards(order: Order): LineCard[] {
    // Turn a whole order into per-line "cards"
    return order.lines.map((l, idx) => ({
      kind: "line" as const,
      id: l.id,
      orderId: order.id,
      shortCode: order.shortCode,
      createdAt: order.createdAt,
      state: order.state,
      // line details
      productName: l.productName,
      qty: l.qty,
      unitLabel: l.unitLabel,
      variantSizeGrams: l.variantSizeGrams,
      prepLabels: Array.isArray(l.prepLabels) ? l.prepLabels : [],
      species: l.species,
      part: l.part,
      index: idx + 1,
      count: order.lines.length,
    }));
  }

  function textMatch(hay: string, needle: string) {
    return hay.toLowerCase().includes(needle.toLowerCase());
  }

  function passesFilter(
    item: Order | ReturnType<typeof makeLineCards>[number],
    query: string
  ) {
    if (!query.trim()) return true;
    const terms = query.trim().split(/\s+/);
    const haystack =
      ("shortCode" in item ? item.shortCode : "") +
      " " +
      ("lines" in item
        ? item.lines
            .map((l) => [
              l.productName,
              l.species,
              l.part ?? "",
              (l.prepLabels ?? []).join(" "),
            ])
            .join(" ")
        : [
            item.productName,
            item.species,
            item.part ?? "",
            (item.prepLabels ?? []).join(" "),
          ].join(" "));
    return terms.every((t) => textMatch(haystack, t));
  }

  function sortItems<
    T extends Order | ReturnType<typeof makeLineCards>[number]
  >(arr: T[], key: SortKey) {
    const by = [...arr];
    by.sort((a, b) => {
      switch (key) {
        case "createdAtAsc":
          return (
            new Date("createdAt" in a ? a.createdAt : "").getTime() -
            new Date("createdAt" in b ? b.createdAt : "").getTime()
          );
        case "createdAtDesc":
          return (
            new Date("createdAt" in b ? b.createdAt : "").getTime() -
            new Date("createdAt" in a ? a.createdAt : "").getTime()
          );
        case "shortCode": {
          const A = "shortCode" in a ? a.shortCode : "";
          const B = "shortCode" in b ? b.shortCode : "";
          return A.localeCompare(B);
        }
        case "species": {
          // For orders, use first line species as a proxy
          const A = ("lines" in a ? a.lines[0]?.species : a.species) || "";
          const B = ("lines" in b ? b.lines[0]?.species : b.species) || "";
          return A.localeCompare(B);
        }
        case "prep": {
          // Join prep labels for comparison
          const A =
            ("lines" in a
              ? (a.lines[0]?.prepLabels ?? []).join(",")
              : (a.prepLabels ?? []).join(",")) || "";
          const B =
            ("lines" in b
              ? (b.lines[0]?.prepLabels ?? []).join(",")
              : (b.prepLabels ?? []).join(",")) || "";
          return A.localeCompare(B);
        }
      }
    });
    return by;
  }

  // Given a state key (column), return the items to render after transform/filter/sort
  function getViewItems(
    colKey: keyof typeof byState
  ): (OrderCard | LineCard)[] {
    const base = byState[colKey] as Order[];
    const flattened = explodeLines ? base.flatMap(makeLineCards) : base;
    const filtered = flattened.filter((it) => passesFilter(it as any, q));
    return sortItems(filtered as any[], sortBy) as (OrderCard | LineCard)[];
  }

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
        {/* Toolbar */}
        <div
          className="border rounded p-2 mb-3"
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontWeight: 600 }}>View</div>

          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={explodeLines}
              onChange={(e) => setExplodeLines(e.target.checked)}
            />
            <span>Explode orders (per line)</span>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span>Sort</span>
            <select
              className="border rounded p-1"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
            >
              <option value="createdAtAsc">Oldest first</option>
              <option value="createdAtDesc">Newest first</option>
              <option value="shortCode">By Code</option>
              <option value="species">By Species</option>
              <option value="prep">By Prep</option>
            </select>
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              flex: 1,
              minWidth: 200,
            }}
          >
            <span>Filter</span>
            <input
              className="border rounded p-1 w-full"
              placeholder="code/species/part/product/prep…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
        </div>

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
                {getViewItems(col.key).map((item: any) => {
                  const isLine = item.kind === "line";
                  const cardKey = isLine ? item.id : item.id;
                  const code = isLine ? item.shortCode : item.shortCode;
                  const created = new Date(
                    isLine ? item.createdAt : item.createdAt
                  ).toLocaleString();

                  return (
                    <article key={cardKey} className="border p-2 rounded">
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <div>
                          <b>#{code}</b>
                          {isLine && (
                            <span
                              style={{
                                marginLeft: 8,
                                fontSize: 12,
                                color: "#666",
                              }}
                            >
                              ({item.index} of {item.count})
                            </span>
                          )}
                        </div>
                        <div style={{ color: "#666", fontSize: 12 }}>
                          {created}
                        </div>
                      </div>

                      {/* Body */}
                      {isLine ? (
                        <>
                          <div style={{ marginTop: 6 }}>
                            {item.qty}× {item.productName}
                            {item.unitLabel ? ` · ${item.unitLabel}` : ""}
                            {typeof item.variantSizeGrams === "number"
                              ? ` · ${item.variantSizeGrams}g`
                              : ""}
                          </div>
                          <div
                            style={{
                              marginTop: 4,
                              fontSize: 12,
                              color: "#444",
                            }}
                          >
                            {item.species} {item.part ? `· ${item.part}` : ""}
                          </div>
                          {Array.isArray(item.prepLabels) &&
                            item.prepLabels.length > 0 && (
                              <div
                                style={{
                                  marginTop: 6,
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: 6,
                                }}
                              >
                                {item.prepLabels.map(
                                  (lab: string, i: number) => (
                                    <span
                                      key={i}
                                      className="border rounded px-2 py-1"
                                      style={{ fontSize: 12 }}
                                    >
                                      {lab}
                                    </span>
                                  )
                                )}
                              </div>
                            )}
                        </>
                      ) : (
                        <>
                          <ul style={{ margin: "8px 0", paddingLeft: 16 }}>
                            {item.lines.map((l: Line) => (
                              <li key={l.id}>
                                {l.qty}× {l.productName}
                                {l.unitLabel ? ` · ${l.unitLabel}` : ""}
                                {typeof l.variantSizeGrams === "number"
                                  ? ` · ${l.variantSizeGrams}g`
                                  : ""}
                                {Array.isArray(l.prepLabels) &&
                                  l.prepLabels.length > 0 && (
                                    <span> · {l.prepLabels.join(", ")}</span>
                                  )}
                              </li>
                            ))}
                          </ul>
                        </>
                      )}

                      {/* Actions */}
                      <div
                        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                      >
                        {NEXT[item.state].map((ns: Order["state"]) => (
                          <button
                            key={ns}
                            className="my_button"
                            onClick={() => move(item.id, ns)}
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
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
