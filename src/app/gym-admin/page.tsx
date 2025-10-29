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
};

type Order = {
  id: string;
  shortCode: string;
  state: OrderState;
  totalCents: number;
  pickupGymName: string | null;
  pickupWhen: string | null;
  createdAt: string;
  gymSettlementId: string | null;
  lines: Line[];
};

type GymLite = { id: string; name: string };

type Settlement = {
  id: string;
  gymId: string;
  totalCents: number;
  orderCount: number;
  createdAt: string;
  createdBy?: { id: string; email: string | null; name: string | null } | null;
  orders?: { id: string; shortCode: string; totalCents: number }[];
};

const CAN_DO: Record<OrderState, OrderState[]> = {
  PENDING: [],
  PREPARING: [],
  READY_FOR_DELIVERY: [],
  IN_TRANSIT: ["AT_GYM"],
  AT_GYM: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: [],
  CANCELLED: [],
};

function Badge({ s }: { s: OrderState }) {
  const color =
    s === "PENDING"
      ? "#aaa"
      : s === "PREPARING"
      ? "#0ea5e9"
      : s === "READY_FOR_DELIVERY"
      ? "#f59e0b"
      : s === "IN_TRANSIT"
      ? "#8b5cf6"
      : s === "AT_GYM"
      ? "#22c55e"
      : s === "PICKED_UP"
      ? "#16a34a"
      : "#ef4444"; // CANCELLED
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        background: color,
        color: "white",
        fontSize: 12,
      }}
    >
      {s}
    </span>
  );
}

export default function GymAdminPage() {
  // Core data
  const [items, setItems] = useState<Order[]>([]);
  const [gyms, setGyms] = useState<GymLite[]>([]);
  const [selectedGymId, setSelectedGymId] = useState<string>("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [poll, setPoll] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  // History data (right column when showHistory = true)
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load gyms the user can admin (kept simple: use /api/gym and take active ones)
  const loadGyms = useCallback(async () => {
    try {
      const r = await fetch("/api/gym", { cache: "no-store" });
      if (!r.ok) return; // ignore silently
      const j = await r.json();
      const list: GymLite[] = (j.items || [])
        .filter((g: any) => g.active)
        .map((g: any) => ({ id: g.id, name: g.name }));
      setGyms(list);
      // if only one gym, auto select
      if (list.length === 1) setSelectedGymId(list[0].id);
    } catch {
      // ignore
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setErr(null);
      setLoading(true);

      // we always load both “left” states and “right” states from the same endpoint
      // (the board will bucket them)
      const states = [
        "PENDING",
        "PREPARING",
        "READY_FOR_DELIVERY",
        "IN_TRANSIT",
        "AT_GYM",
        "PICKED_UP",
      ].join(",");

      const qs =
        selectedGymId && selectedGymId.length
          ? `?states=${encodeURIComponent(states)}&gymId=${encodeURIComponent(
              selectedGymId
            )}`
          : `?states=${encodeURIComponent(states)}`;

      const r = await fetch(`/api/gym/orders${qs}`, { cache: "no-store" });
      if (!r.ok) throw new Error(r.statusText);
      const j = await r.json();
      setItems(j.items || []);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [selectedGymId]);

  const loadHistory = useCallback(async () => {
    if (!showHistory) return;
    try {
      setLoadingHistory(true);
      const qs =
        selectedGymId && selectedGymId.length
          ? `?gymId=${encodeURIComponent(selectedGymId)}`
          : "";
      const r = await fetch(`/api/gym/settlements/list${qs}`, {
        cache: "no-store",
      });
      if (!r.ok) return;
      const j = await r.json();
      setSettlements(j.items || []);
    } finally {
      setLoadingHistory(false);
    }
  }, [selectedGymId, showHistory]);

  // initial gyms + initial data
  useEffect(() => {
    loadGyms();
  }, [loadGyms]);

  useEffect(() => {
    load();
  }, [load]);

  // history loader on toggle/gym change
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // polling
  useEffect(() => {
    if (!poll) return;
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [poll, load]);

  // Buckets
  const upcoming = useMemo(
    () =>
      items.filter(
        (o) =>
          o.state === "PENDING" ||
          o.state === "PREPARING" ||
          o.state === "READY_FOR_DELIVERY"
      ),
    [items]
  );

  const inTransit = useMemo(
    () => items.filter((o) => o.state === "IN_TRANSIT"),
    [items]
  );

  const atGym = useMemo(
    () => items.filter((o) => o.state === "AT_GYM"),
    [items]
  );

  const completedUnsettled = useMemo(
    () => items.filter((o) => o.state === "PICKED_UP" && !o.gymSettlementId),
    [items]
  );

  const unsettledTotalCents = useMemo(
    () => completedUnsettled.reduce((s, o) => s + (o.totalCents || 0), 0),
    [completedUnsettled]
  );

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

  async function settleNow() {
    try {
      const body =
        selectedGymId && selectedGymId.length ? { gymId: selectedGymId } : {}; // API will infer if only one permitted

      const r = await fetch("/api/gym/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        alert(j?.error ?? r.statusText);
        return;
      }
      // refresh both orders & history
      await load();
      await loadHistory();
      alert(
        `Settled ${j?.count ?? 0} orders · ${(
          (j?.totalCents ?? 0) / 100
        ).toFixed(2)} €`
      );
    } catch (e: any) {
      alert(e?.message ?? String(e));
    }
  }

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
        {/* Gym selector only if multiple gyms */}
        {gyms.length > 1 && (
          <select
            className="border p-2 rounded"
            value={selectedGymId}
            onChange={(e) => setSelectedGymId(e.target.value)}
          >
            <option value="">All permitted gyms</option>
            {gyms.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        )}

        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={poll}
            onChange={(e) => setPoll(e.target.checked)}
          />
          Auto-refresh
        </label>

        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={showHistory}
            onChange={(e) => setShowHistory(e.target.checked)}
          />
          Show history
        </label>

        <button className="my_button" onClick={load}>
          Refresh
        </button>
      </div>

      {err && (
        <div style={{ color: "crimson", marginBottom: 8 }}>Error: {err}</div>
      )}
      {loading && <div>Loading…</div>}

      {/* 3 columns */}
      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(3, minmax(0,1fr))",
        }}
      >
        {/* LEFT: Upcoming (read-only) + In Transit (actionable) */}
        <section className="border rounded p-2">
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>
            Incoming & In-Transit{" "}
            <span style={{ color: "#666" }}>
              ({upcoming.length + inTransit.length})
            </span>
          </h2>

          {/* Upcoming */}
          {!!upcoming.length && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 600, margin: "6px 0" }}>Incoming</div>
              <div style={{ display: "grid", gap: 8 }}>
                {upcoming.map((o) => (
                  <article
                    key={o.id}
                    className="border p-2 rounded"
                    style={{ opacity: 0.9 }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <div>
                        <b>#{o.shortCode}</b> <Badge s={o.state} />
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
                    <div style={{ color: "#666", fontSize: 12 }}>
                      Pickup: {o.pickupGymName ?? "—"}
                    </div>
                    <div>
                      <b>Total:</b> {(o.totalCents / 100).toFixed(2)} €
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* In Transit */}
          <div>
            <div style={{ fontWeight: 600, margin: "6px 0" }}>In Transit</div>
            <div style={{ display: "grid", gap: 8 }}>
              {inTransit.map((o) => {
                const canArrive = (CAN_DO[o.state] || []).includes("AT_GYM");
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
                        <b>#{o.shortCode}</b> <Badge s={o.state} />
                      </div>
                      <div style={{ color: "#666", fontSize: 12 }}>
                        {o.pickupWhen
                          ? new Date(o.pickupWhen).toLocaleString()
                          : new Date(o.createdAt).toLocaleString()}
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
                      <button
                        className="my_button"
                        onClick={() => move(o.id, "AT_GYM")}
                        title="Mark the order as arrived"
                        disabled={!canArrive}
                      >
                        Arrived
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* MIDDLE: At Gym */}
        <section className="border rounded p-2">
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>
            At Gym <span style={{ color: "#666" }}>({atGym.length})</span>
          </h2>

          <div style={{ display: "grid", gap: 8 }}>
            {atGym.map((o) => (
              <article key={o.id} className="border p-2 rounded">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <div>
                    <b>#{o.shortCode}</b> <Badge s={o.state} />
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
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    className="my_button"
                    onClick={() => move(o.id, "PICKED_UP")}
                    title="Customer picked up"
                  >
                    Picked up
                  </button>
                  <button
                    className="my_button"
                    onClick={() => move(o.id, "CANCELLED")}
                    title="Order cancelled"
                  >
                    Cancel
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* RIGHT: Completed (unsettled) OR History */}
        <section className="border rounded p-2">
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>
            {showHistory ? "History" : "Completed"}
          </h2>

          {!showHistory ? (
            <>
              {/* Completed & unsettled */}
              <div style={{ display: "grid", gap: 8 }}>
                {completedUnsettled.map((o) => (
                  <article
                    key={o.id}
                    className="border p-2 rounded"
                    style={{ opacity: 0.95 }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <div>
                        <b>#{o.shortCode}</b> <Badge s={o.state} />
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
                    <div>
                      <b>Total:</b> {(o.totalCents / 100).toFixed(2)} €
                    </div>
                  </article>
                ))}
              </div>

              {/* Remittance summary */}
              <div
                style={{
                  marginTop: 12,
                  paddingTop: 8,
                  borderTop: "1px solid #e5e7eb",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  Unsettled total: {(unsettledTotalCents / 100).toFixed(2)} €
                </div>
                <button
                  className="my_button"
                  disabled={completedUnsettled.length === 0}
                  onClick={settleNow}
                  title={
                    selectedGymId
                      ? `Settle for selected gym`
                      : `Settle for permitted gym(s)`
                  }
                >
                  Settle & Clear
                </button>
              </div>
            </>
          ) : (
            <>
              {loadingHistory && <div>Loading history…</div>}
              {!loadingHistory && !settlements.length && (
                <div>No settlements yet.</div>
              )}
              <div style={{ display: "grid", gap: 8 }}>
                {settlements.map((s) => (
                  <article key={s.id} className="border p-2 rounded">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <div>
                        <b>Settlement</b> {s.id.slice(0, 8)}…
                      </div>
                      <div style={{ color: "#666", fontSize: 12 }}>
                        {new Date(s.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ marginTop: 6, color: "#444" }}>
                      Orders: <b>{s.orderCount}</b> · Total:{" "}
                      <b>{(s.totalCents / 100).toFixed(2)} €</b>
                      {s.createdBy?.email ? (
                        <span style={{ color: "#666" }}>
                          {" "}
                          · by {s.createdBy.email}
                        </span>
                      ) : null}
                    </div>
                    {!!s.orders?.length && (
                      <ul style={{ margin: "8px 0", paddingLeft: 16 }}>
                        {s.orders.map((o) => (
                          <li key={o.id}>
                            #{o.shortCode} — {(o.totalCents / 100).toFixed(2)} €
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
