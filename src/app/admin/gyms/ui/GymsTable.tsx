"use client";

import { useEffect, useState } from "react";

type AdminRow = {
  id: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
};
type Gym = {
  id: string;
  name: string;
  address?: string | null;
  notes?: string | null;
  active: boolean;
  admins: AdminRow[];
};

export default function GymsTable() {
  const [items, setItems] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/gyms", { cache: "no-store" });
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
    const h = () => load();
    window.addEventListener("gyms:refresh", h);
    return () => window.removeEventListener("gyms:refresh", h);
  }, []);

  async function toggleActive(g: Gym) {
    const r = await fetch(`/api/gyms/${g.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !g.active }),
    });
    if (!r.ok) return alert("Update failed");
    load();
  }

  async function addAdmin(gymId: string) {
    const email = prompt("Admin user email:")?.trim();
    if (!email) return;
    const r = await fetch(`/api/gyms/${gymId}/admins`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      return alert("Add admin failed: " + (j?.error ?? r.statusText));
    }
    load();
  }

  async function removeAdmin(gymId: string, userId: string) {
    if (!confirm("Remove this admin?")) return;
    const r = await fetch(`/api/gyms/${gymId}/admins/${userId}`, {
      method: "DELETE",
    });
    if (r.status !== 204) return alert("Remove failed");
    load();
  }

  if (loading) return <div>Loading gyms…</div>;
  if (err) return <div style={{ color: "crimson" }}>Error: {err}</div>;
  if (!items.length) return <div>No gyms yet.</div>;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
            <th style={{ padding: 8 }}>Name</th>
            <th style={{ padding: 8 }}>Address</th>
            <th style={{ padding: 8 }}>Active</th>
            <th style={{ padding: 8 }}>Admins</th>
            <th style={{ padding: 8, width: 220 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((g) => (
            <tr key={g.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: 8 }}>{g.name}</td>
              <td style={{ padding: 8 }}>{g.address ?? "—"}</td>
              <td style={{ padding: 8 }}>{g.active ? "✅" : "❌"}</td>
              <td style={{ padding: 8 }}>
                {g.admins.length
                  ? g.admins.map((a) => a.userEmail ?? a.userId).join(", ")
                  : "—"}
              </td>
              <td style={{ padding: 8, display: "flex", gap: 8 }}>
                <button className="my_button" onClick={() => toggleActive(g)}>
                  {g.active ? "Deactivate" : "Activate"}
                </button>
                <button className="my_button" onClick={() => addAdmin(g.id)}>
                  Add admin
                </button>
                {!!g.admins.length && (
                  <button
                    className="my_button"
                    onClick={() => {
                      const pick = prompt(
                        "Enter admin userId to remove:\n" +
                          g.admins
                            .map(
                              (a) =>
                                `${a.userId} (${a.userEmail ?? "no email"})`
                            )
                            .join("\n")
                      )?.trim();
                      if (pick) removeAdmin(g.id, pick);
                    }}
                  >
                    Remove admin
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
        (Later, replace the prompts with a nicer modal/search.)
      </div>
    </div>
  );
}
