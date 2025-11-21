// src/app/admin/products/ProductEditModal.tsx

"use client";

import { useEffect, useMemo, useState } from "react";

// Keep in sync with API types (only fields we edit here)
type Variant = {
  id?: string;
  sizeGrams: number;
  priceCents: number;
  sku?: string | null;
  inStock?: boolean;
  sortOrder?: number;
};

type Option = {
  id?: string;
  label: string;
  priceDeltaCents?: number;
  isDefault?: boolean;
  sortOrder?: number;
};

type Group = {
  id?: string;
  name: string;
  type: "SINGLE" | "MULTIPLE";
  required?: boolean;
  minSelect?: number | null;
  maxSelect?: number | null;
  sortOrder?: number;
  perKg?: boolean;
  options: Option[];
};

type Product = {
  id: string;
  name: string;
  species:
    | "BEEF"
    | "CHICKEN"
    | "TURKEY"
    | "DUCK"
    | "GOOSE"
    | "SALMON"
    | "OTHER";
  part: string | null;
  description?: string | null;
  imageUrl?: string | null;
  active: boolean;
  variants: Variant[];
  optionGroups: Group[];
};

export default function ProductEditModal({
  id,
  open,
  onClose,
  onSaved,
}: {
  id: string | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [species, setSpecies] = useState<Product["species"]>("CHICKEN");
  const [part, setPart] = useState<string | "">("");
  const [imageUrl, setImageUrl] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);

  // edit as JSON for powerful bulk changes
  const [variantsJson, setVariantsJson] = useState("[]");
  const [groupsJson, setGroupsJson] = useState("[]");
  const [pruneRemoved, setPruneRemoved] = useState(false); // optional destructive action

  // load current
  useEffect(() => {
    if (!open || !id) return;
    setLoading(true);
    setError(null);
    fetch(`/api/products/${id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const p: Product = j.item;
        setName(p.name || "");
        setSpecies(p.species);
        setPart(p.part || "");
        setImageUrl(p.imageUrl || "");
        setDescription(p.description || "");
        setActive(!!p.active);
        setVariantsJson(JSON.stringify(p.variants || [], null, 2));
        setGroupsJson(JSON.stringify(p.optionGroups || [], null, 2));
      })
      .catch((e) => setError(e?.message ?? "Failed to load"))
      .finally(() => setLoading(false));
  }, [open, id]);

  const canSave = useMemo(() => !!name && !!species, [name, species]);

  async function onSave() {
    if (!id) return;
    setSaving(true);
    setError(null);

    // parse JSON blocks
    let variants: Variant[] = [];
    let optionGroups: Group[] = [];
    try {
      variants = JSON.parse(variantsJson || "[]");
      if (!Array.isArray(variants))
        throw new Error("variants must be an array");
    } catch (e: any) {
      setSaving(false);
      setError("Invalid Variants JSON: " + (e?.message ?? String(e)));
      return;
    }
    try {
      optionGroups = JSON.parse(groupsJson || "[]");
      if (!Array.isArray(optionGroups))
        throw new Error("optionGroups must be an array");
    } catch (e: any) {
      setSaving(false);
      setError("Invalid Option Groups JSON: " + (e?.message ?? String(e)));
      return;
    }

    const payload: any = {
      name: name.trim(),
      species,
      part: part || null,
      imageUrl: imageUrl.trim() || null,
      description: description.trim() || null,
      active,
      // Optional blocks
      optionGroups,
      variants,
      pruneRemovedVariants: pruneRemoved,
    };

    const r = await fetch(`/api/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j?.error ?? r.statusText);
      setSaving(false);
      return;
    }

    setSaving(false);
    onSaved();
    onClose();
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "grid",
        placeItems: "center",
      }}
    >
      {/* scrim */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
        }}
      />

      <div
        style={{
          position: "relative",
          width: "min(1100px, 96vw)",
          maxHeight: "90vh",
          overflow: "auto",
          background: "var(--red-800)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 16,
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h2 id="edit-title" style={{ fontSize: 20, fontWeight: 700 }}>
            Edit product
          </h2>
          <div style={{ marginLeft: "auto" }}>
            <button onClick={onClose} className="my_button">
              Close
            </button>
          </div>
        </div>

        {loading ? (
          <div>Loading…</div>
        ) : (
          <>
            {error && <div style={{ color: "#ffbaba" }}>⚠ {error}</div>}

            {/* Basics */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <label>
                <div>Name</div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="border p-2 rounded w-full"
                />
              </label>
              <label>
                <div>Species</div>
                <select
                  value={species}
                  onChange={(e) =>
                    setSpecies(e.target.value as Product["species"])
                  }
                  className="border p-2 rounded w-full"
                >
                  <option>BEEF</option>
                  <option>CHICKEN</option>
                  <option>TURKEY</option>
                  <option>DUCK</option>
                  <option>GOOSE</option>
                  <option>SALMON</option>
                  <option>OTHER</option>
                </select>
              </label>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <label>
                <div>Part (optional)</div>
                <input
                  value={part}
                  onChange={(e) => setPart(e.target.value)}
                  placeholder="e.g. RIBEYE"
                  className="border p-2 rounded w-full"
                />
              </label>

              <label
                style={{ display: "flex", alignItems: "flex-end", gap: 8 }}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                <span>Active</span>
              </label>
            </div>

            <label>
              <div>Image URL</div>
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="border p-2 rounded w-full"
              />
            </label>

            <label>
              <div>Description</div>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="border p-2 rounded w-full"
              />
            </label>

            {/* Variants JSON */}
            <label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div>Variants (JSON)</div>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    opacity: 0.9,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={pruneRemoved}
                    onChange={(e) => setPruneRemoved(e.target.checked)}
                  />
                  Prune removed (delete missing variants)
                </label>
              </div>
              <textarea
                rows={10}
                value={variantsJson}
                onChange={(e) => setVariantsJson(e.target.value)}
                className="border p-2 rounded w-full"
              />
            </label>

            {/* Option Groups JSON */}
            <label>
              <div>Option Groups (JSON)</div>
              <textarea
                rows={10}
                value={groupsJson}
                onChange={(e) => setGroupsJson(e.target.value)}
                className="border p-2 rounded w-full"
              />
              <div style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>
                Full replace semantics for option groups. For weight-based
                origin pricing, set <code>perKg: true</code> on a group e.g.
                Origin and use
                <code>priceDeltaCents</code> as Ft/kg.
              </div>
            </label>

            <div
              style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
            >
              <button onClick={onClose} className="my_button">
                Cancel
              </button>
              <button
                onClick={onSave}
                disabled={!canSave || saving}
                className="my_button"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
