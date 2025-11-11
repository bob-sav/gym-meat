"use client";

import { useMemo, useState } from "react";
import { signIn } from "next-auth/react";

export default function LoginClient({
  verify,
  from,
}: {
  verify: string | null;
  from: string | null;
}) {
  // Only allow same-site relative redirects
  const callbackUrl = useMemo(
    () => (from && from.startsWith("/") ? from : "/"),
    [from]
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const [remember, setRemember] = useState(true);

  async function onLogin(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg(null);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
      remember, // (optional – ignored by server for now)
    });

    setBusy(false);

    if (!res) return setMsg("No response from auth.");
    if (res.error) {
      return setMsg(
        res.error === "CredentialsSignin"
          ? "Invalid email or password."
          : `Login failed: ${res.error}`
      );
    }
    window.location.href = res.url ?? callbackUrl;
  }

  async function resend() {
    setResendMsg(null);
    if (!email) {
      setResendMsg("Enter your email above first.");
      return;
    }
    try {
      const r = await fetch("/api/auth/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setResendMsg(
        r.ok
          ? "If an unverified account exists, a new link was sent."
          : "Could not send email. Try again later."
      );
    } catch {
      setResendMsg("Network error. Please try again.");
    }
  }

  const Notice = () => {
    const box: React.CSSProperties = {
      padding: "8px 12px",
      borderRadius: 8,
      marginBottom: 12,
      fontSize: 14,
      lineHeight: 1.35,
    };
    if (verify === "ok") {
      return (
        <p
          style={{ ...box, background: "#e6ffed", border: "1px solid #b7eb8f" }}
        >
          Email verified. You can log in now.
        </p>
      );
    }
    if (verify === "email_taken") {
      return <p className="notice warn">That email is already in use.</p>;
    }

    if (verify === "expired" || verify === "invalid") {
      return (
        <div
          style={{
            ...box,
            background: verify === "expired" ? "#fff7e6" : "#fff1f0",
            border:
              verify === "expired" ? "1px solid #ffe58f" : "1px solid #ffa39e",
          }}
        >
          {verify === "expired"
            ? "Link expired."
            : "Invalid verification link."}{" "}
          {email ? (
            <button
              type="button"
              onClick={resend}
              disabled={busy}
              className="my_button"
              style={{ marginLeft: 8 }}
            >
              Resend verification
            </button>
          ) : (
            <span>Enter your email above and click “Resend verification”.</span>
          )}
          {resendMsg && <div style={{ marginTop: 6 }}>{resendMsg}</div>}
        </div>
      );
    }
    return null;
  };

  return (
    <main style={{ maxWidth: 420, margin: "3rem auto", padding: "1rem" }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>Log in</h1>

      <form onSubmit={onLogin} style={{ display: "grid", gap: 8 }}>
        <Notice />

        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="Email"
          className="border p-2 rounded"
          autoComplete="username"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="Password"
          className="border p-2 rounded"
          autoComplete="current-password"
        />

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          Keep me signed in for 30 days
        </label>

        <button type="submit" disabled={busy} className="my_button">
          {busy ? "Signing in…" : "Log in"}
        </button>

        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl })}
          className="my_button"
        >
          Continue with Google
        </button>

        {(verify === "expired" || verify === "invalid") && (
          <button
            type="button"
            onClick={resend}
            disabled={busy || !email}
            className="my_button"
            style={{ opacity: email ? 1 : 0.7 }}
          >
            Resend verification
          </button>
        )}
      </form>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}

      <p style={{ marginTop: 16, opacity: 0.7 }}>
        No account yet? <a href="/signup">Create one</a>
      </p>
      <p style={{ marginTop: 8 }}>
        <a href="/forgot">Forgot your password?</a>
      </p>
    </main>
  );
}
