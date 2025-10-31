"use client";

import { useEffect, useState } from "react";

type AdminRow = {
  id: string;
  userId: string;
  role: "PREP_ONLY" | "SETTLEMENT";
  userEmail: string | null;
  userName: string | null;
  createdAt: string;
};

export default function ButchersAdminPage() {
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"PREP_ONLY" | "SETTLEMENT">("PREP_ONLY");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/butcher/admins", { cache: "no-store" });
    const j = await r.json();
    setRows(j.items || []);
  }
  useEffect(() => {
    load();
  }, []);

  async function addAdmin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/butcher/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), role }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setMsg(j?.error ?? r.statusText);
    else {
      setMsg("✅ Saved");
      setEmail("");
      setRole("PREP_ONLY");
      load();
    }
    setBusy(false);
  }

  async function changeRole(id: string, newRole: "PREP_ONLY" | "SETTLEMENT") {
    const r = await fetch(`/api/butcher/admins/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      return alert(j?.error ?? r.statusText);
    }
    load();
  }

  async function remove(id: string) {
    if (!confirm("Remove this butcher admin?")) return;
    const r = await fetch(`/api/butcher/admins/${id}`, { method: "DELETE" });
    if (r.status !== 204) return alert("Delete failed");
    load();
  }

  return (
    <main style={{ maxWidth: 900, margin: "2rem auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>Butcher Admins</h1>

      <form
        onSubmit={addAdmin}
        style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}
      >
        <input
          className="border p-2 rounded"
          placeholder="user@example.com"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ minWidth: 260 }}
        />
        <select
          className="border p-2 rounded"
          value={role}
          onChange={(e) => setRole(e.target.value as any)}
        >
          <option value="PREP_ONLY">Prep only</option>
          <option value="SETTLEMENT">Can settle</option>
        </select>
        <button className="my_button" disabled={busy}>
          {busy ? "Saving…" : "Add / Update"}
        </button>
        {msg && <div style={{ alignSelf: "center", color: "#666" }}>{msg}</div>}
      </form>

      {!rows.length ? (
        <p>No butcher admins yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {rows.map((r) => (
            <article
              key={r.id}
              className="border p-2 rounded"
              style={{ display: "grid", gap: 8 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  <div>
                    <b>{r.userName || r.userEmail || r.userId}</b>
                  </div>
                  <div style={{ color: "#666", fontSize: 12 }}>
                    Added: {new Date(r.createdAt).toLocaleString()}
                  </div>
                </div>
                <div>
                  <button className="my_button" onClick={() => remove(r.id)}>
                    Remove
                  </button>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 14, color: "#555" }}>Role</label>
                <select
                  className="border p-2 rounded"
                  value={r.role}
                  onChange={(e) => changeRole(r.id, e.target.value as any)}
                >
                  <option value="PREP_ONLY">Prep only</option>
                  <option value="SETTLEMENT">Can settle</option>
                </select>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
