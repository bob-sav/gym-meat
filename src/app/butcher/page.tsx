"use client";

import { useEffect, useMemo, useState } from "react";

type LineState = "PENDING" | "PREPARING" | "READY" | "SENT";

type LineItem = {
  id: string; // lineId
  orderId: string;
  shortCode: string;
  createdAt: string;
  pickupGymName: string | null;

  productName: string;
  qty: number;
  unitLabel: string | null;
  basePriceCents: number;
  species: string;
  part: string | null;
  variantSizeGrams: number | null;
  prepLabels: string[];

  lineState: LineState;
  indexOf: { i: number; n: number };
};

const COLS: { key: LineState; title: string }[] = [
  { key: "PENDING", title: "Pending" },
  { key: "PREPARING", title: "Preparing" },
  { key: "READY", title: "Ready" },
  { key: "SENT", title: "Sent" },
];

// single-step transitions
const NEXT: Record<LineState, LineState[]> = {
  PENDING: ["PREPARING"],
  PREPARING: ["READY", "PENDING"],
  READY: ["PREPARING", "SENT"],
  SENT: ["READY"],
};

export default function ButcherBoard() {
  const [items, setItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Toolbar state
  const [showSent, setShowSent] = useState(false);
  const [poll, setPoll] = useState(true);
  const [speciesFilter, setSpeciesFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  async function load() {
    try {
      setErr(null);
      setLoading(true);
      // We can filter by state server-side if you want; for now pull everything and filter client-side
      const r = await fetch("/api/butcher/lines", { cache: "no-store" });
      if (!r.ok) throw new Error(r.statusText);
      const j = await r.json();
      setItems(j.items || []);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!poll) return;
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [poll]);

  // Derived maps for quick checks
  const orderAllReady = useMemo(() => {
    const m = new Map<string, boolean>();
    const grouped = items.reduce<Record<string, LineItem[]>>((acc, li) => {
      (acc[li.orderId] ||= []).push(li);
      return acc;
    }, {});
    for (const [oid, arr] of Object.entries(grouped)) {
      m.set(
        oid,
        arr.every((l) => l.lineState === "READY")
      );
    }
    return m;
  }, [items]);

  // Filters
  const filtered = useMemo(() => {
    let arr = items.slice();
    if (!showSent) arr = arr.filter((l) => l.lineState !== "SENT");
    if (speciesFilter) arr = arr.filter((l) => l.species === speciesFilter);
    if (search) {
      const s = search.toLowerCase();
      arr = arr.filter(
        (l) =>
          l.shortCode.includes(s) ||
          l.productName.toLowerCase().includes(s) ||
          (l.prepLabels || []).some((p) => p.toLowerCase().includes(s))
      );
    }
    return arr;
  }, [items, showSent, speciesFilter, search]);

  const byState = useMemo(() => {
    const m: Record<LineState, LineItem[]> = {
      PENDING: [],
      PREPARING: [],
      READY: [],
      SENT: [],
    };
    for (const li of filtered) m[li.lineState].push(li);
    return m;
  }, [filtered]);

  async function move(lineId: string, next: LineState) {
    try {
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
      await load();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    }
  }

  const allSpecies = Array.from(new Set(items.map((l) => l.species)));

  return (
    <main style={{ maxWidth: 1200, margin: "2rem auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>Butcher · Line Items</h1>

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
            checked={showSent}
            onChange={(e) => setShowSent(e.target.checked)}
          />
          Show Sent
        </label>

        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={poll}
            onChange={(e) => setPoll(e.target.checked)}
          />
          Auto-refresh
        </label>

        <select
          className="border p-2 rounded"
          value={speciesFilter}
          onChange={(e) => setSpeciesFilter(e.target.value)}
        >
          <option value="">All species</option>
          {allSpecies.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

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

      {err && (
        <div style={{ color: "crimson", marginBottom: 8 }}>Error: {err}</div>
      )}
      {loading && <div>Loading…</div>}

      {/* Columns */}
      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(4, minmax(0,1fr))",
        }}
      >
        {COLS.map((col) => (
          <section key={col.key} className="border rounded p-2">
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>
              {col.title}{" "}
              <span style={{ color: "#666" }}>({byState[col.key].length})</span>
            </h2>

            <div style={{ display: "grid", gap: 8 }}>
              {byState[col.key].map((li) => {
                const canSendOut =
                  li.lineState === "READY" &&
                  (orderAllReady.get(li.orderId) ?? false);

                return (
                  <article key={li.id} className="border p-2 rounded">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <div>
                        <b>#{li.shortCode}</b>{" "}
                        <span style={{ color: "#666" }}>
                          ({li.indexOf.i} of {li.indexOf.n})
                        </span>
                      </div>
                      <div style={{ color: "#666", fontSize: 12 }}>
                        {new Date(li.createdAt).toLocaleString()}
                      </div>
                    </div>

                    <div style={{ marginTop: 6 }}>
                      <div style={{ fontWeight: 600 }}>{li.productName}</div>
                      <div style={{ color: "#666", fontSize: 13 }}>
                        {li.qty}×{li.unitLabel ? ` · ${li.unitLabel}` : ""}
                        {li.variantSizeGrams
                          ? ` · ${li.variantSizeGrams}g`
                          : ""}
                        {li.part ? ` · ${li.part}` : ""}
                        {li.pickupGymName ? ` · Gym: ${li.pickupGymName}` : ""}
                      </div>
                      {!!li.prepLabels?.length && (
                        <div style={{ marginTop: 4, fontSize: 13 }}>
                          Prep: {li.prepLabels.join(", ")}
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        marginTop: 8,
                      }}
                    >
                      {/* Back / Undo */}
                      {li.lineState !== "PENDING" && (
                        <button
                          className="my_button"
                          onClick={() =>
                            move(
                              li.id,
                              li.lineState === "READY" ? "PREPARING" : "PENDING"
                            )
                          }
                        >
                          Undo
                        </button>
                      )}

                      {/* Forward */}
                      {li.lineState === "PENDING" && (
                        <button
                          className="my_button"
                          onClick={() => move(li.id, "PREPARING")}
                        >
                          Start
                        </button>
                      )}
                      {li.lineState === "PREPARING" && (
                        <button
                          className="my_button"
                          onClick={() => move(li.id, "READY")}
                        >
                          Mark Ready
                        </button>
                      )}
                      {li.lineState === "READY" && (
                        <button
                          className="my_button"
                          onClick={() => move(li.id, "SENT")}
                          disabled={!canSendOut}
                          title={
                            canSendOut
                              ? "Send this order now"
                              : "All items in this order must be READY"
                          }
                        >
                          Send Out
                        </button>
                      )}

                      {/* Minor undo from SENT */}
                      {li.lineState === "SENT" && (
                        <button
                          className="my_button"
                          onClick={() => move(li.id, "READY")}
                        >
                          Undo Sent
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
