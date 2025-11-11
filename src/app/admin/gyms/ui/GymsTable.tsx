// src/app/admin/gyms/ui/GymsTable.tsx
"use client";

import { useEffect, useState } from "react";

type GymAdminView = {
  id: string; // GymAdmin row id
  userId: string;
  userEmail: string | null;
  userName: string | null;
};

type Gym = {
  id: string;
  name: string;
  address: string | null;
  notes: string | null;
  active: boolean;
  admins: GymAdminView[];
};

export default function GymsTable() {
  const [items, setItems] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/gym", { cache: "no-store" });
      const j = await r.json();
      setItems(j.items || []);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const fn = () => load();
    window.addEventListener("gym:refresh", fn);
    load();
    return () => window.removeEventListener("gym:refresh", fn);
  }, []);

  async function toggleActive(g: Gym) {
    const r = await fetch(`/api/gym/${g.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !g.active }),
    });
    if (!r.ok) return alert("Update failed");
    load();
  }

  async function addAdmin(gymId: string) {
    const email = prompt("Admin user email:")?.trim();
    if (!email) return;
    const r = await fetch(`/api/gym/${gymId}/admins`, {
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

  async function removeAdmin(gymId: string, adminId: string) {
    if (!confirm("Remove this admin?")) return;
    const r = await fetch(`/api/gym/${gymId}/admins/${adminId}`, {
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
            <th style={{ padding: 8, minWidth: 260 }}>Admins</th>
            <th style={{ padding: 8, width: 220 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((g) => (
            <tr key={g.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: 8 }}>{g.name}</td>
              <td style={{ padding: 8 }}>{g.address ?? "—"}</td>
              <td style={{ padding: 8 }}>{g.active ? "✅" : "❌"}</td>

              {/* Admins column: show list + per-admin remove button */}
              <td style={{ padding: 8 }}>
                {g.admins.length === 0 ? (
                  <span style={{ color: "#666" }}>No admins</span>
                ) : (
                  <ul
                    style={{
                      display: "grid",
                      gap: 6,
                      margin: 0,
                      paddingLeft: 16,
                    }}
                  >
                    {g.admins.map((a) => (
                      <li
                        key={a.id}
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                        }}
                        title={`GymAdmin ID: ${a.id}`}
                      >
                        <span>
                          {a.userEmail ?? a.userId}
                          {a.userName ? ` (${a.userName})` : ""}
                        </span>
                        <button
                          className="my_button"
                          onClick={() => removeAdmin(g.id, a.id)}
                          style={{ background: "#ec1818ff" }}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </td>

              {/* Actions column */}
              <td style={{ padding: 8, display: "flex", gap: 8 }}>
                <button className="my_button" onClick={() => toggleActive(g)}>
                  {g.active ? "Deactivate" : "Activate"}
                </button>
                <button className="my_button" onClick={() => addAdmin(g.id)}>
                  Add admin
                </button>
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
