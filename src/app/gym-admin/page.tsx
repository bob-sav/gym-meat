// src/app/gym-admin/page.tsx
"use client";

import { formatDateBudapest, formatHuf } from "@/lib/format";
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
                : "#ef4444";
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

  // History data
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Helpers
  const hasMultiGyms = gyms.length > 1;
  const activeGymName = hasMultiGyms
    ? gyms.find((g) => g.id === selectedGymId)?.name || ""
    : gyms[0]?.name || "";

  // Load gyms the user can admin
  const loadGyms = useCallback(async () => {
    try {
      // inside loadGyms()
      const r = await fetch("/api/gym?scope=my", { cache: "no-store" });

      if (!r.ok) return;
      const j = await r.json();
      const list: GymLite[] = (j.items || [])
        .filter((g: any) => g.active)
        .map((g: any) => ({ id: g.id, name: g.name }));
      setGyms(list);
      if (list.length === 1) setSelectedGymId(list[0].id);
    } catch {
      // ignore
    }
  }, []);

  // Load orders for the chosen (or only) gym
  const load = useCallback(async () => {
    try {
      setErr(null);
      setLoading(true);

      // Multi-gym admin must choose
      if (gyms.length > 1 && !selectedGymId) {
        setItems([]);
        return;
      }

      const states = [
        "PENDING",
        "PREPARING",
        "READY_FOR_DELIVERY",
        "IN_TRANSIT",
        "AT_GYM",
        "PICKED_UP",
      ].join(",");

      const gymIdParam =
        gyms.length > 1 ? selectedGymId : gyms[0]?.id || undefined;

      const qs = gymIdParam
        ? `?states=${encodeURIComponent(states)}&gymId=${encodeURIComponent(
            gymIdParam
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
  }, [gyms, selectedGymId]);

  // Load settlement history (optional right column)
  const loadHistory = useCallback(async () => {
    if (!showHistory) return;

    if (gyms.length > 1 && !selectedGymId) {
      setSettlements([]);
      return;
    }

    try {
      setLoadingHistory(true);
      const gymIdParam =
        gyms.length > 1 ? selectedGymId : gyms[0]?.id || undefined;

      const qs = gymIdParam ? `?gymId=${encodeURIComponent(gymIdParam)}` : "";
      const r = await fetch(`/api/gym/settlements/list${qs}`, {
        cache: "no-store",
      });
      if (!r.ok) return;
      const j = await r.json();
      setSettlements(j.items || []);
    } finally {
      setLoadingHistory(false);
    }
  }, [gyms, selectedGymId, showHistory]);

  // Initial load
  useEffect(() => {
    loadGyms();
  }, [loadGyms]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Polling
  useEffect(() => {
    if (!poll) return;
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [poll, load]);

  // Buckets (use items as-is; server already filtered by gym)
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
    if (gyms.length > 1 && !selectedGymId) {
      alert("Please select a gym first.");
      return;
    }
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
    if (gyms.length > 1 && !selectedGymId) {
      alert("Please select a gym first.");
      return;
    }
    try {
      const body =
        gyms.length > 1
          ? { gymId: selectedGymId }
          : gyms[0]?.id
            ? { gymId: gyms[0].id }
            : {};

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
      await load();
      await loadHistory();
      alert(
        `Settled ${j?.count ?? 0} orders · ${formatHuf(j?.totalCents ?? 0)}`
      );
    } catch (e: any) {
      alert(e?.message ?? String(e));
    }
  }

  return (
    <main style={{ maxWidth: 1200, margin: "2rem auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>
        Gym Admin{activeGymName ? ` · ${activeGymName}` : ""}
      </h1>

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
        {gyms.length > 1 ? (
          <>
            <select
              className="border p-2 rounded"
              value={selectedGymId}
              onChange={(e) => setSelectedGymId(e.target.value)}
            >
              <option value="">— Select a gym —</option>
              {gyms.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            {!selectedGymId && (
              <span style={{ color: "#b45309" }}>
                Select a gym to view and act on its orders.
              </span>
            )}
          </>
        ) : (
          gyms.length === 1 && (
            <span style={{ fontWeight: 600 }}>Gym: {gyms[0].name}</span>
          )
        )}

        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={poll}
            onChange={(e) => setPoll(e.target.checked)}
            disabled={gyms.length > 1 && !selectedGymId}
          />
          Auto-refresh
        </label>

        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={showHistory}
            onChange={(e) => setShowHistory(e.target.checked)}
            disabled={gyms.length > 1 && !selectedGymId}
          />
          Show history
        </label>

        <button
          className="my_button"
          onClick={load}
          disabled={gyms.length > 1 && !selectedGymId}
        >
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
        {/* LEFT: Incoming + In-Transit */}
        <section className="border rounded p-2">
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>
            Incoming & In-Transit{" "}
            <span style={{ color: "#666" }}>
              ({upcoming.length + inTransit.length})
            </span>
          </h2>

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
                        {formatDateBudapest(o.createdAt)}
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
                      Pickup: {o.pickupGymName || "—"}
                    </div>
                    <div>
                      <b>Total:</b> {formatHuf(o.totalCents)}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

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
                          ? formatDateBudapest(o.pickupWhen)
                          : formatDateBudapest(o.createdAt)}
                      </div>
                    </div>
                    <div>
                      <b>Total:</b> {formatHuf(o.totalCents)}
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
                        disabled={gyms.length > 1 && !selectedGymId}
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
                    {formatDateBudapest(o.createdAt)}
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
                <div>
                  <b>Total:</b> {formatHuf(o.totalCents)}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    className="my_button"
                    onClick={() => move(o.id, "PICKED_UP")}
                    title="Customer picked up"
                    disabled={gyms.length > 1 && !selectedGymId}
                  >
                    Picked up
                  </button>
                  <button
                    className="my_button"
                    onClick={() => move(o.id, "CANCELLED")}
                    title="Order cancelled"
                    disabled={gyms.length > 1 && !selectedGymId}
                  >
                    Cancel
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* RIGHT: Completed (unsettled) or History */}
        <section className="border rounded p-2">
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>
            {showHistory ? "History" : "Completed"}
          </h2>

          {!showHistory ? (
            <>
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
                        {formatDateBudapest(o.createdAt)}
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
                      <b>Total:</b> {formatHuf(o.totalCents)}
                    </div>
                  </article>
                ))}
              </div>

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
                  Unsettled total: {formatHuf(unsettledTotalCents)}
                </div>
                <button
                  className="my_button"
                  onClick={settleNow}
                  disabled={
                    (gyms.length > 1 && !selectedGymId) ||
                    completedUnsettled.length === 0
                  }
                  title={
                    gyms.length > 1
                      ? selectedGymId
                        ? "Settle for selected gym"
                        : "Select a gym"
                      : "Settle"
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
                        {formatDateBudapest(s.createdAt)}
                      </div>
                    </div>
                    <div style={{ marginTop: 6, color: "#444" }}>
                      Orders: <b>{s.orderCount}</b> · Total:{" "}
                      <b>{formatHuf(s.totalCents)} </b>
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
                            #{o.shortCode} — {formatHuf(o.totalCents)}
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
