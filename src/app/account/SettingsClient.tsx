"use client";
import { useState } from "react";

export default function SettingsClient({ email }: { email: string }) {
  // Change password
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);

  // Change email
  const [newEmail, setNewEmail] = useState("");
  const [emMsg, setEmMsg] = useState<string | null>(null);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    const r = await fetch("/api/account/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: cur, newPassword: next }),
      credentials: "include", // 👈 ensure cookie goes with the request
    });

    setPwMsg(
      r.ok
        ? "Password updated. Please log in again."
        : ((await r.json()).error ?? "Failed.")
    );
  }

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmMsg(null);
    const r = await fetch("/api/account/change-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newEmail }),
      credentials: "include", // 👈
    });

    setEmMsg(
      r.ok
        ? "Verification sent to your new email."
        : ((await r.json()).error ?? "Failed.")
    );
  }

  return (
    <main
      style={{
        maxWidth: 560,
        margin: "3rem auto",
        padding: 16,
        display: "grid",
        gap: 24,
      }}
    >
      <section>
        <h2>Account</h2>
        <p>
          Current email: <b>{email}</b>
        </p>
      </section>

      <section>
        <h3>Change password</h3>
        <form
          onSubmit={changePassword}
          style={{ display: "grid", gap: 8, maxWidth: 420 }}
        >
          <input
            value={cur}
            onChange={(e) => setCur(e.target.value)}
            type="password"
            placeholder="Current password"
          />
          <input
            value={next}
            onChange={(e) => setNext(e.target.value)}
            type="password"
            placeholder="New password"
          />
          <button className="my_button">Update password</button>
          {pwMsg && <p>{pwMsg}</p>}
        </form>
      </section>

      <section>
        <h3>Change email</h3>
        <form
          onSubmit={changeEmail}
          style={{ display: "grid", gap: 8, maxWidth: 420 }}
        >
          <input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            type="email"
            placeholder="New email"
          />
          <button className="my_button">Send verification</button>
          {emMsg && <p>{emMsg}</p>}
        </form>
      </section>
    </main>
  );
}
