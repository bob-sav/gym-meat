"use client";

import { useEffect, useState } from "react";

type Gym = { id: string; name: string };

export default function CheckoutForm() {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [pickupGymId, setPickupGymId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // 1) fetch gyms once
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/gyms", { cache: "no-store" });
        const j = await r.json();
        if (!alive) return;
        setGyms(j.items || []);
      } catch {
        if (!alive) return;
        setGyms([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 2) pick a default when gyms load (but don't clobber a user choice)
  useEffect(() => {
    if (gyms.length && !pickupGymId) {
      setPickupGymId(gyms[0].id);
    }
  }, [gyms, pickupGymId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pickupGymId: pickupGymId || undefined,
        notes: notes.trim() || undefined,
      }),
    });

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg(j?.error ?? res.statusText);
      setBusy(false);
      return;
    }

    window.location.href = "/thank-you";
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
      <label>
        <div>Pickup gym</div>
        <select
          className="border p-2 rounded w-full"
          value={pickupGymId}
          onChange={(e) => setPickupGymId(e.target.value)}
          required
        >
          {gyms.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        <div>Notes (optional)</div>
        <textarea
          className="border p-2 rounded w-full"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything the butcher should know…"
        />
      </label>

      <button
        className="my_button"
        disabled={busy || !pickupGymId || gyms.length === 0}
      >
        {busy ? "Placing order…" : "Place order"}
      </button>

      {msg && <div style={{ color: "crimson" }}>{msg}</div>}
    </form>
  );
}
