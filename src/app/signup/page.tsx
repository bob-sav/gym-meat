// src/app/signup/page.tsx
"use client";

import { useState } from "react";

export default function SignUpPage() {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);

    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get("name") || "").trim() || undefined,
      email: String(form.get("email") || "").trim(),
      password: String(form.get("password") || ""),
    };

    // Call the verification-based register route
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setMsg("Account created — check your email to verify your address.");
      // Optionally clear the form
      (e.currentTarget as HTMLFormElement).reset();
    } else {
      const j = await res.json().catch(() => ({}) as any);
      // Surface a friendly error if your register route returns codes/messages
      setMsg(j?.error || "Something went wrong.");
    }

    setBusy(false);
  }

  return (
    <main style={{ maxWidth: 420, margin: "3rem auto", padding: "1rem" }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>Create account</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 8 }}>
        <input
          name="name"
          placeholder="Name (optional)"
          className="border p-2 rounded"
          autoComplete="name"
        />
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className="border p-2 rounded"
          autoComplete="email"
        />
        <input
          name="password"
          type="password"
          placeholder="Password (min 8)"
          required
          className="border p-2 rounded"
          autoComplete="new-password"
          minLength={8}
        />
        <button disabled={busy} className="my_button">
          {busy ? "Creating…" : "Sign up"}
        </button>
      </form>

      <p style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
        Use at least 8 characters. We’ll email you a verification link.
      </p>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}

      <p style={{ marginTop: 16, opacity: 0.7 }}>
        Already have an account? <a href="/login">Log in</a>
      </p>
    </main>
  );
}
