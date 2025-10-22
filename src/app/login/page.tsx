"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onLogin() {
    setBusy(true);
    setMsg(null);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false, // <- don't auto-redirect
      callbackUrl: "/", // where we want to go on success
    });

    setBusy(false);

    if (!res) {
      setMsg("No response from auth.");
      return;
    }
    if (res.error) {
      setMsg(`Login failed: ${res.error}`);
      return;
    }

    // success: manually follow the URL returned by next-auth
    window.location.href = res.url ?? "/";
  }

  return (
    <main style={{ maxWidth: 420, margin: "3rem auto", padding: "1rem" }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>Log in</h1>
      <div style={{ display: "grid", gap: 8 }}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="Email"
          className="border p-2 rounded"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="Password"
          className="border p-2 rounded"
        />
        <button
          type="button"
          disabled={busy}
          onClick={onLogin}
          className="my_button"
        >
          {busy ? "Signing in…" : "Log in"}
        </button>
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="my_button"
        >
          Continue with Google
        </button>
      </div>
      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
      <p style={{ marginTop: 16, opacity: 0.7 }}>
        No account yet? <a href="/signup">Create one</a>
      </p>
    </main>
  );
}
