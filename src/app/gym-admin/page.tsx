"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";

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
  state: string;
  totalCents: number;
  pickupGymName: string | null;
  pickupWhen: string | null;
  createdAt: string;
  lines: Line[];
};

export default function GymAdminPage() {
  const [items, setItems] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load(state?: string) {
    setLoading(true);
    setErr(null);
    try {
      const qs = state ? `?state=${encodeURIComponent(state)}` : "";
      const r = await fetch(`/api/gym/orders${qs}`, { cache: "no-store" });
      const j = await r.json();
      setItems(j.items || []);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(); // all states by default
  }, []);

  async function markPickedUp(id: string) {
    const ok = confirm("Mark this order as PICKED_UP?");
    if (!ok) return;
    const r = await fetch(`/api/orders/${id}/state`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: "PICKED_UP" }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert(j?.error ?? r.statusText);
      return;
    }
    await load(); // refresh
  }

  return (
    <main style={{ maxWidth: 1100, margin: "2rem auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>Gym Admin</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button className="my_button" onClick={() => load()}>
          All
        </button>
        <button className="my_button" onClick={() => load("AT_GYM")}>
          AT_GYM
        </button>
        <button
          className="my_button"
          onClick={() => load("READY_FOR_DELIVERY")}
        >
          READY_FOR_DELIVERY
        </button>
        <button className="my_button" onClick={() => load("PENDING")}>
          PENDING
        </button>
      </div>

      {loading && <div>Loading…</div>}
      {err && <div style={{ color: "crimson" }}>{err}</div>}
      {!loading && !items.length && <div>No orders.</div>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        {items.map((o) => (
          <div key={o.id} className="border p-3 rounded">
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <div>
                  <b>Code:</b>{" "}
                  <span style={{ fontFamily: "monospace" }}>{o.shortCode}</span>
                </div>
                <div>
                  <b>Status:</b> {o.state}
                </div>
                <div>
                  <b>Pickup:</b> {o.pickupGymName ?? "—"}
                  {o.pickupWhen
                    ? `, ${new Date(o.pickupWhen).toLocaleString()}`
                    : ""}
                </div>
                <div style={{ color: "#666", fontSize: 12 }}>
                  Placed: {new Date(o.createdAt).toLocaleString()}
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div>
                  <b>Total:</b> {(o.totalCents / 100).toFixed(2)} €
                </div>
                {o.state !== "PICKED_UP" && (
                  <button
                    className="my_button"
                    style={{ marginTop: 8 }}
                    onClick={() => markPickedUp(o.id)}
                  >
                    Mark picked up
                  </button>
                )}
              </div>
            </div>

            <div style={{ marginTop: 8 }}>
              <b>Items:</b>
              <ul style={{ marginTop: 6 }}>
                {o.lines.map((l) => (
                  <li key={l.id}>
                    {l.qty} × {l.productName}
                    {l.unitLabel ? ` (${l.unitLabel})` : ""} —{" "}
                    {(l.basePriceCents / 100).toFixed(2)} €
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
