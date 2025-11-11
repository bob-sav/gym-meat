"use client";
import { useState } from "react";

export default function ResetClient({ token }: { token: string }) {
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const valid = token && p1.length >= 8 && p2 === p1;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: p1 }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg(j.error ?? "Could not reset password.");
      } else {
        setMsg("Password updated. You can log in now.");
        // Optional: redirect after 2s
        setTimeout(() => (window.location.href = "/login?reset=ok"), 1500);
      }
    } catch {
      setMsg("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 420, margin: "3rem auto", padding: 16 }}>
      <h1>Set a new password</h1>
      {!token ? (
        <p>
          Reset link is invalid. <a href="/forgot">Request a new one</a>.
        </p>
      ) : (
        <form onSubmit={submit} style={{ display: "grid", gap: 8 }}>
          <input
            type="password"
            placeholder="New password"
            value={p1}
            onChange={(e) => setP1(e.target.value)}
            className="border p-2 rounded"
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={p2}
            onChange={(e) => setP2(e.target.value)}
            className="border p-2 rounded"
          />
          <button className="my_button" disabled={!valid || busy}>
            {busy ? "Updating…" : "Update password"}
          </button>
          {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
        </form>
      )}
    </main>
  );
}
