"use client";

import { useEffect, useState } from "react";

type OrderRow = { id: string; shortCode: string; totalCents: number };
type SettlementRow = {
  id: string;
  createdAt: string;
  totalCents: number;
  orderCount: number;
  notes: string | null;
  createdBy?: { name: string | null; email: string | null } | null;
  orders: OrderRow[];
};

export default function ButcherSettlementsPage() {
  const [eligibleCount, setEligibleCount] = useState(0);
  const [eligibleTotal, setEligibleTotal] = useState(0);
  const [settlements, setSettlements] = useState<SettlementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  async function load() {
    setMsg(null);
    setLoading(true);
    try {
      // dry-run preview
      {
        const r = await fetch("/api/butcher/settlements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dryRun: true }),
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok) {
          setEligibleCount(Number(j.eligibleCount || 0));
          setEligibleTotal(Number(j.totalCents || 0));
        } else {
          setEligibleCount(0);
          setEligibleTotal(0);
          setMsg(j?.error ?? r.statusText);
        }
      }
      // list
      {
        const r = await fetch("/api/butcher/settlements/list", {
          cache: "no-store",
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok) {
          setSettlements(Array.isArray(j.items) ? j.items : []);
        } else {
          setSettlements([]);
          setMsg(j?.error ?? r.statusText);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function settleNow() {
    if (!eligibleCount) return;
    if (!confirm(`Settle ${eligibleCount} orders now?`)) return;

    setMsg(null);
    setLoading(true);
    try {
      const r = await fetch("/api/butcher/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dryRun: false,
          notes: notes.trim() || undefined,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg(j?.error ?? r.statusText);
      } else {
        setNotes("");
        await load();
        alert(
          `✅ Settled ${j?.count ?? 0} orders · ${(
            (j?.totalCents ?? 0) / 100
          ).toFixed(2)} €`
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: "2rem auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>Butcher · Settlements</h1>

      {msg && (
        <div style={{ color: "crimson", marginBottom: 8 }}>Error: {msg}</div>
      )}
      {loading && <div>Loading…</div>}

      <section className="border rounded p-3" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Eligible now</h2>
        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <b>{eligibleCount}</b> orders ·{" "}
            <b>{(eligibleTotal / 100).toFixed(2)} €</b>
          </div>
          <input
            className="border p-2 rounded"
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ minWidth: 260 }}
          />
          <button
            className="my_button"
            onClick={settleNow}
            disabled={eligibleCount === 0 || loading}
            title={
              eligibleCount
                ? "Create a settlement & clear"
                : "Nothing eligible yet"
            }
          >
            Settle & Clear
          </button>
          <button className="my_button" onClick={load} disabled={loading}>
            Refresh
          </button>
        </div>
      </section>

      <section className="border rounded p-3">
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Recent settlements</h2>
        {!settlements.length ? (
          <div>No settlements yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {settlements.map((s) => (
              <article key={s.id} className="border rounded p-2">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div>
                      <b>{(s.totalCents / 100).toFixed(2)} €</b> ·{" "}
                      {s.orderCount} orders
                    </div>
                    <div style={{ color: "#666", fontSize: 12 }}>
                      {new Date(s.createdAt).toLocaleString()}
                      {s.createdBy?.name || s.createdBy?.email ? (
                        <> · by {s.createdBy?.name ?? s.createdBy?.email}</>
                      ) : null}
                    </div>
                    {s.notes && (
                      <div
                        style={{ marginTop: 4, fontSize: 13, color: "#444" }}
                      >
                        Notes: {s.notes}
                      </div>
                    )}
                  </div>
                </div>

                {!!s.orders?.length && (
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: "pointer" }}>View orders</summary>
                    <ul style={{ marginTop: 6, paddingLeft: 18 }}>
                      {s.orders.map((o) => (
                        <li key={o.id}>
                          #{o.shortCode} · {(o.totalCents / 100).toFixed(2)} €
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
