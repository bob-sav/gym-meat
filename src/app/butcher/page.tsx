// src/app/butcher/page.tsx
"use client";

import { formatHuf, formatDateBudapest } from "@/lib/format";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  indexOf?: { i: number; n: number };
  orderState:
    | "PENDING"
    | "PREPARING"
    | "READY_FOR_DELIVERY"
    | "IN_TRANSIT"
    | "AT_GYM"
    | "PICKED_UP"
    | "CANCELLED";
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
  const [prepFilter, setPrepFilter] = useState<
    "" | "WHOLE" | "DICED" | "GROUND"
  >("");
  const [search, setSearch] = useState("");
  const [sentSort, setSentSort] = useState<"newest" | "oldest">("newest");

  // helper: robust case-insensitive match (handles labels like "Whole", "Ground meat", etc.)
  function matchesPrep(li: LineItem, target: "WHOLE" | "DICED" | "GROUND") {
    const needle = target.toLowerCase();
    return (li.prepLabels || []).some((p) => p.toLowerCase().includes(needle));
  }

  const load = useCallback(async () => {
    try {
      setErr(null);
      setLoading(true);
      const sentParam = showSent ? "all" : "in_transit";
      const r = await fetch(`/api/butcher/lines?sent=${sentParam}`, {
        // <-- backticks
        cache: "no-store",
      });
      if (!r.ok) throw new Error(r.statusText);
      const j = await r.json();

      const normalized = (j.items || []).map((li: any) => {
        const idx =
          li?.indexOf &&
          typeof li.indexOf.i === "number" &&
          typeof li.indexOf.n === "number"
            ? li.indexOf
            : { i: 1, n: 1 };
        return { ...li, indexOf: idx };
      });

      setItems(normalized);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [showSent]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!poll) return;
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [poll, load]);

  // Derived maps for quick checks
  const orderSendable = useMemo(() => {
    const m = new Map<string, boolean>();
    const grouped = items.reduce<Record<string, LineItem[]>>((acc, li) => {
      (acc[li.orderId] ||= []).push(li);
      return acc;
    }, {});
    for (const [oid, arr] of Object.entries(grouped)) {
      // Sendable if no item is still PENDING or PREPARING
      m.set(
        oid,
        arr.every((l) => l.lineState === "READY" || l.lineState === "SENT")
      );
    }
    return m;
  }, [items]);

  // Filters
  const filtered = useMemo(() => {
    let arr = items.slice();

    // species filter
    if (speciesFilter) arr = arr.filter((l) => l.species === speciesFilter);

    // prep filter
    if (prepFilter) {
      arr = arr.filter((l) => matchesPrep(l, prepFilter));
    }

    // search (code / product / prep)
    if (search) {
      const s = search.toLowerCase();
      arr = arr.filter(
        (l) =>
          l.shortCode.toLowerCase().includes(s) ||
          l.productName.toLowerCase().includes(s) ||
          (l.prepLabels || []).some((p) => p.toLowerCase().includes(s))
      );
    }

    return arr;
  }, [items, speciesFilter, prepFilter, search]);

  // Only the SENT cards; sorted for the history view when showSent is ON
  const sentList = useMemo(() => {
    const arr = filtered.filter((l) => l.lineState === "SENT").slice();
    arr.sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return sentSort === "newest" ? tb - ta : ta - tb;
    });
    return arr;
  }, [filtered, sentSort]);

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
      const r = await fetch(`/api/butcher/lines/${lineId}/state`, {
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

        {showSent && (
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            Sort Sent:
            <select
              className="border p-2 rounded"
              value={sentSort}
              onChange={(e) =>
                setSentSort(e.target.value as "newest" | "oldest")
              }
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
        )}

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

        {/* Prep filter: Whole / Diced / Ground */}
        <fieldset
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "6px 10px",
          }}
        >
          <legend style={{ fontSize: 12, opacity: 0.85, padding: "0 4px" }}>
            Prep
          </legend>

          <label
            style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
          >
            <input
              type="radio"
              name="prepFilter"
              value=""
              checked={prepFilter === ""}
              onChange={() => setPrepFilter("")}
            />
            All
          </label>

          <label
            style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
          >
            <input
              type="radio"
              name="prepFilter"
              value="WHOLE"
              checked={prepFilter === "WHOLE"}
              onChange={() => setPrepFilter("WHOLE")}
            />
            Whole
          </label>

          <label
            style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
          >
            <input
              type="radio"
              name="prepFilter"
              value="DICED"
              checked={prepFilter === "DICED"}
              onChange={() => setPrepFilter("DICED")}
            />
            Diced
          </label>

          <label
            style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
          >
            <input
              type="radio"
              name="prepFilter"
              value="GROUND"
              checked={prepFilter === "GROUND"}
              onChange={() => setPrepFilter("GROUND")}
            />
            Ground
          </label>
        </fieldset>

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
              {(col.key === "SENT" ? sentList : byState[col.key]).map((li) => {
                const canSendOut =
                  li.lineState === "READY" &&
                  (orderSendable.get(li.orderId) ?? false);

                return (
                  <article key={li.id} className="card">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "8px",
                      }}
                    >
                      <div>
                        <b>#{li.shortCode}</b>{" "}
                      </div>
                      <div>
                        <b>
                          ({li.indexOf?.i ?? 1} of {li.indexOf?.n ?? 1})
                        </b>
                      </div>
                    </div>

                    <div style={{ marginTop: "1rem" }}>
                      <div style={{ fontWeight: 600 }}>
                        {li.species} {li.part ? ` · ${li.part}` : ""}
                      </div>
                      <div style={{ fontWeight: 600, marginTop: "0.375rem" }}>
                        {li.qty}×{li.unitLabel ? ` · ${li.unitLabel}` : ""}
                        {li.variantSizeGrams
                          ? ` · ${li.variantSizeGrams}g`
                          : ""}
                      </div>
                      {!!li.prepLabels?.length && (
                        <div style={{ marginTop: "0.375rem", fontWeight: 600 }}>
                          Prep: {li.prepLabels.join(", ")}
                        </div>
                      )}

                      {li.lineState === "READY" && (
                        <div style={{ marginTop: "1rem" }} className="total">
                          {/* Replace this with your actual total calculation and display */}
                          Total: {formatHuf(li.basePriceCents * li.qty)}
                        </div>
                      )}
                    </div>
                    <div style={{ marginTop: "1rem" }}>
                      <div style={{ fontWeight: 300, fontSize: "0.9rem" }}>
                        {li.pickupGymName ? ` Gym: ${li.pickupGymName}` : ""}
                      </div>
                      <div style={{ fontWeight: 300, fontSize: "0.9rem" }}>
                        {li.productName}
                      </div>
                      <div style={{ fontSize: "0.75rem" }}>
                        {formatDateBudapest(li.createdAt)}
                      </div>
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
                      {li.lineState !== "PENDING" &&
                        li.lineState !== "SENT" && (
                          <button
                            className="my_button"
                            onClick={() =>
                              move(
                                li.id,
                                li.lineState === "READY"
                                  ? "PREPARING"
                                  : "PENDING"
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

                      {/* Undo from SENT:
              - Allowed only when NOT in history view (showSent === false).
              - In history view (showSent === true), this is hidden to prevent retro edits. */}
                      {li.lineState === "SENT" && !showSent && (
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
