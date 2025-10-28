// src/app/gym-admin/page.tsx
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

export default function GymAdminPage() {
  const [items, setItems] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [poll, setPoll] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);

  const load = useCallback(async () => {
    try {
      setErr(null);
      setLoading(true);

      // Which states to load?
      const states = showCompleted
        ? "AT_GYM,PICKED_UP"
        : "PENDING,PREPARING,READY_FOR_DELIVERY,IN_TRANSIT";

      const r = await fetch(
        `/api/gym/orders?states=${encodeURIComponent(states)}`,
        {
          cache: "no-store",
        }
      );
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

  // Buckets for rendering
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

  const pickedUp = useMemo(
    () => items.filter((o) => o.state === "PICKED_UP"),
    [items]
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

  return (
    <main style={{ maxWidth: 1200, margin: "2rem auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>Gym Admin</h1>

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
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
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
          />
          Show completed view
        </label>

        <button className="my_button" onClick={load}>
          Refresh
        </button>
      </div>

      {err && (
        <div style={{ color: "crimson", marginBottom: 8 }}>Error: {err}</div>
      )}
      {loading && <div>Loading…</div>}

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(2, minmax(0,1fr))",
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

          {/* Upcoming (read-only cards) */}
          {!!upcoming.length && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 600, margin: "6px 0" }}>Incoming</div>
              <div style={{ display: "grid", gap: 8 }}>
                {upcoming.map((o) => (
                  <article
                    key={o.id}
                    className="border p-2 rounded"
                    style={{ opacity: 0.85 }}
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
                        </li>
                      ))}
                    </ul>
                    <div style={{ color: "#666", fontSize: 12 }}>
                      Pickup: {o.pickupGymName ?? "—"}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* In Transit (action: mark AT_GYM) */}
          <div>
            <div style={{ fontWeight: 600, margin: "6px 0" }}>In Transit</div>
            <div style={{ display: "grid", gap: 8 }}>
              {inTransit.map((o) => (
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
                      </li>
                    ))}
                  </ul>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      className="my_button"
                      onClick={() => move(o.id, "AT_GYM")}
                      title="Mark the order as arrived"
                    >
                      Arrived
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* RIGHT: At Gym / Completed */}
        <section className="border rounded p-2">
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>
            At Gym / Completed{" "}
            <span style={{ color: "#666" }}>
              ({atGym.length + pickedUp.length})
            </span>
          </h2>

          {/* AT_GYM (actionable) */}
          {!!atGym.length && (
            <>
              <div style={{ fontWeight: 600, margin: "6px 0" }}>At Gym</div>
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
            </>
          )}

          {/* PICKED_UP (read-only) */}
          {!!pickedUp.length && (
            <>
              <div style={{ fontWeight: 600, margin: "12px 0 6px" }}>
                Picked Up
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {pickedUp.map((o) => (
                  <article
                    key={o.id}
                    className="border p-2 rounded"
                    style={{ opacity: 0.85 }}
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
                        </li>
                      ))}
                    </ul>
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
