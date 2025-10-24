"use client";
import { useState } from "react";

export default function GymForm() {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);

    const r = await fetch("/api/gym", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
      }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setMsg("Create failed: " + (j?.error ?? r.statusText));
    } else {
      setMsg("✅ Created");
      setName("");
      setAddress("");
      setNotes("");
      window.dispatchEvent(new Event("gym:refresh"));
    }
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
      <label>
        <div>Name</div>
        <input
          className="my_input"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        <div>Address</div>
        <input
          className="my_input"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </label>
      <label>
        <div>Notes</div>
        <textarea
          className="my_input"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <button className="my_button" disabled={busy}>
        {busy ? "Creating..." : "Create Gym"}
      </button>
      {msg && <div>{msg}</div>}
    </form>
  );
}
