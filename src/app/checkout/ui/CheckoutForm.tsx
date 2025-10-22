"use client";

import { useState } from "react";

export default function CheckoutForm() {
  const [pickupGymName, setPickupGymName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);

    try {
      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickupGymName: pickupGymName.trim(),
          note: note.trim() || undefined,
        }),
      });

      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error ?? r.statusText);
      }

      const { order } = await r.json();
      // clear cart for this browser
      await fetch("/api/cart", { method: "DELETE" });

      // go to thank-you page with the short code
      window.location.href = `/thank-you?code=${encodeURIComponent(
        order.shortCode
      )}&gym=${encodeURIComponent(order.pickupGymName ?? "")}`;
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
      <label>
        <div>Pickup gym</div>
        <input
          required
          value={pickupGymName}
          onChange={(e) => setPickupGymName(e.target.value)}
          className="border p-2 rounded w-full"
          placeholder="e.g., Downtown Gym"
        />
      </label>

      <label>
        <div>Note to butcher (optional)</div>
        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="border p-2 rounded w-full"
          placeholder="Anything special we should know?"
        />
      </label>

      <button type="submit" disabled={busy} className="my_button">
        {busy ? "Placing order..." : "Place order"}
      </button>

      {err && <div style={{ color: "crimson" }}>{err}</div>}
    </form>
  );
}
