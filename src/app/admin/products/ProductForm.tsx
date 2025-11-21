// src/app/admin/products/ProductForm.tsx
"use client";

import { useState } from "react";

type GroupType = "SINGLE" | "MULTIPLE";

type OptionInput = {
  label: string;
  priceDeltaCents?: number;
  priceDeltaPerKgCents?: number;
  isDefault?: boolean;
  sortOrder?: number;
};

type GroupInput = {
  name: string;
  type: GroupType;
  required?: boolean;
  minSelect?: number | null;
  maxSelect?: number | null;
  sortOrder?: number;
  perKg?: boolean;
  options: OptionInput[];
};

type VariantInput = {
  sizeGrams: number; // e.g. 250 | 500 | 750 | 1000
  priceCents: number; // price for that size
  sku?: string;
  inStock?: boolean;
  sortOrder?: number;
};

const DEFAULT_GROUPS: GroupInput[] = [
  {
    name: "Cut",
    type: "SINGLE",
    required: true,
    options: [
      { label: "Whole", isDefault: true, priceDeltaCents: 0, sortOrder: 0 },
      { label: "Diced", priceDeltaCents: 0, sortOrder: 1 },
      { label: "Ground", priceDeltaCents: 0, sortOrder: 2 },
    ],
  },
  {
    name: "Origin",
    type: "SINGLE",
    required: true,
    perKg: true,
    options: [
      { label: "Local", isDefault: true, priceDeltaPerKgCents: 0 },
      { label: "Angus", priceDeltaPerKgCents: 2000 },
      { label: "Wagyu", priceDeltaPerKgCents: 8000 },
    ],
  },
  {
    name: "Prep Extras",
    type: "MULTIPLE",
    options: [{ label: "de-boned, trimmed", priceDeltaCents: 0, sortOrder: 0 }],
  },
];

const DEFAULT_VARIANTS: VariantInput[] = [
  { sizeGrams: 250, priceCents: 0, inStock: true, sortOrder: 0 },
  { sizeGrams: 500, priceCents: 0, inStock: true, sortOrder: 1 },
  { sizeGrams: 750, priceCents: 0, inStock: true, sortOrder: 2 },
  { sizeGrams: 1000, priceCents: 0, inStock: true, sortOrder: 3 },
];

const PARTS = [
  "SIRLOIN",
  "RIBEYE",
  "TENDERLOIN",
  "RUMP",
  "SHORT_LOIN",
  "BREAST",
  "THIGH",
  "WHOLE_BIRD",
  "FILLET",
  "OTHER",
] as const;

export default function ProductForm() {
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("CHICKEN");
  const [part, setPart] = useState<string>("");
  const [imageUrl, setImageUrl] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);

  const [variantsJson, setVariantsJson] = useState<string>(
    JSON.stringify(DEFAULT_VARIANTS, null, 2)
  );
  const [optionGroupsJson, setOptionGroupsJson] = useState<string>(
    JSON.stringify(DEFAULT_GROUPS, null, 2)
  );

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);

    let parsedGroups: GroupInput[] = [];
    let parsedVariants: VariantInput[] = [];

    try {
      parsedGroups = optionGroupsJson ? JSON.parse(optionGroupsJson) : [];
      if (!Array.isArray(parsedGroups))
        throw new Error("optionGroups must be an array");
    } catch (err: any) {
      setBusy(false);
      setMessage(`Invalid optionGroups JSON: ${err?.message ?? String(err)}`);
      return;
    }

    try {
      parsedVariants = variantsJson ? JSON.parse(variantsJson) : [];
      if (!Array.isArray(parsedVariants))
        throw new Error("variants must be an array");
      if (parsedVariants.length < 1)
        throw new Error("at least one variant is required");
    } catch (err: any) {
      setBusy(false);
      setMessage(`Invalid variants JSON: ${err?.message ?? String(err)}`);
      return;
    }

    const payload = {
      name: name.trim(),
      species,
      part: part || undefined, // optional
      description: description.trim() || undefined,
      imageUrl: imageUrl.trim() || undefined,
      active,
      variants: parsedVariants,
      optionGroups: parsedGroups,
    };

    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage(`Create failed: ${data?.error ?? res.statusText}`);
      setBusy(false);
      return;
    }

    setMessage("✅ Product created");
    setBusy(false);

    // Refresh the iframe to show the new/updated list
    const iframe = document.querySelector<HTMLIFrameElement>(
      'iframe[title="products-json"]'
    );
    if (iframe) iframe.src = "/api/products?ts=" + Date.now();
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label>
          <div>Name</div>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border p-2 rounded w-full"
          />
        </label>
        <label>
          <div>Species</div>
          <select
            value={species}
            onChange={(e) => setSpecies(e.target.value)}
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label>
          <div>Part (optional)</div>
          <select
            value={part}
            onChange={(e) => setPart(e.target.value)}
            className="border p-2 rounded w-full"
          >
            <option value="">— None —</option>
            {PARTS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
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

      <label>
        <div>Variants (JSON)</div>
        <textarea
          rows={10}
          value={variantsJson}
          onChange={(e) => setVariantsJson(e.target.value)}
          className="border p-2 rounded w-full"
        />
        <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
          Example:
          <pre className="whitespace-pre-wrap">
            {`[
  { "sizeGrams": 250,  "priceCents": 399, "inStock": true,  "sortOrder": 0 },
  { "sizeGrams": 500,  "priceCents": 699, "inStock": true,  "sortOrder": 1 },
  { "sizeGrams": 750,  "priceCents": 999, "inStock": true,  "sortOrder": 2 },
  { "sizeGrams": 1000, "priceCents": 1299,"inStock": true,  "sortOrder": 3 }
]`}
          </pre>
        </div>
      </label>

      <label>
        <div>Option Groups (JSON)</div>
        <textarea
          rows={10}
          value={optionGroupsJson}
          onChange={(e) => setOptionGroupsJson(e.target.value)}
          className="border p-2 rounded w-full"
        />
        <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
          Tip: keep <b>Cut</b> as a SINGLE required group (one default), and{" "}
          <b>Prep Extras</b> as MULTIPLE.
        </div>
      </label>

      <button
        type="submit"
        disabled={busy}
        className="my_button"
        style={{ background: busy ? "#ec1818ff" : "#2306ff" }}
      >
        {busy ? "Creating..." : "Create product"}
      </button>

      {message && <div style={{ marginTop: 8 }}>{message}</div>}
    </form>
  );
}
