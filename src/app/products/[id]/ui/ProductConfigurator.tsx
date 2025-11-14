// src/app/products/[id]/ui/ProductConfigurator.tsx
"use client";

import { formatHuf } from "@/lib/format";
import { useMemo, useState, useCallback } from "react";

type Option = {
  id: string;
  label: string;
  priceDeltaCents: number;
  isDefault: boolean;
  sortOrder: number;
};
type Group = {
  id: string;
  name: string;
  type: "SINGLE" | "MULTIPLE";
  required: boolean;
  minSelect: number | null;
  maxSelect: number | null;
  sortOrder: number;
  options: Option[];
};
type Variant = {
  id: string;
  sizeGrams: number;
  priceCents: number;
  inStock: boolean;
  sortOrder: number;
};
type Product = {
  id: string;
  name: string;
  variants: Variant[];
  optionGroups: Group[];
};

function formatSize(g: number) {
  if (g >= 1000) return `${(g / 1000).toFixed(1)} kg`;
  return `${g} g`;
}

export default function ProductConfigurator({ product }: { product: Product }) {
  // choose default variant: first in-stock, else first
  const defaultVariant =
    product.variants.find((v) => v.inStock) ?? product.variants[0];

  const [variantId, setVariantId] = useState<string | undefined>(
    defaultVariant?.id
  );

  const [selected, setSelected] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    for (const g of product.optionGroups) {
      const defaults = g.options.filter((o) => o.isDefault).map((o) => o.id);
      init[g.id] = defaults.length ? defaults : [];
    }
    return init;
  });

  const activeVariant = useMemo(
    () => product.variants.find((v) => v.id === variantId),
    [product.variants, variantId]
  );

  const totalCents = useMemo(() => {
    const base = activeVariant?.priceCents ?? 0;
    let extras = 0;
    for (const g of product.optionGroups) {
      for (const oid of selected[g.id] || []) {
        const opt = g.options.find((o) => o.id === oid);
        if (opt) extras += opt.priceDeltaCents;
      }
    }
    return base + extras;
  }, [activeVariant, product.optionGroups, selected]);

  function toggle(g: Group, oid: string) {
    setSelected((prev) => {
      const curr = new Set(prev[g.id] || []);
      if (g.type === "SINGLE") {
        return { ...prev, [g.id]: [oid] };
      } else {
        if (curr.has(oid)) curr.delete(oid);
        else curr.add(oid);
        const max = g.maxSelect ?? Infinity;
        const arr = Array.from(curr).slice(0, max as number);
        return { ...prev, [g.id]: arr };
      }
    });
  }

  const addToCart = useCallback(async () => {
    if (!activeVariant) {
      alert("Please select a size/variant.");
      return;
    }
    if (!activeVariant.inStock) {
      alert("Selected variant is out of stock.");
      return;
    }

    const optionIds = Object.values(selected).flat();

    const r = await fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: product.id,
        variantId: activeVariant.id,
        optionIds,
        qty: 1,
      }),
    });

    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert("Add to cart failed: " + (j?.error ?? r.statusText));
      return;
    }
    window.dispatchEvent(new Event("cart:bump"));

    const go = confirm("Added to cart. Go to cart?");
    if (go) location.href = "/cart";
  }, [activeVariant, product.id, selected]);

  return (
    <div style={{ marginTop: 16 }}>
      {/* Variant picker */}
      {product.variants.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Size</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {product.variants.map((v) => {
              const active = v.id === variantId;
              return (
                <button
                  key={v.id}
                  onClick={() => setVariantId(v.id)}
                  disabled={!v.inStock}
                  className="my_button"
                  style={{
                    background: active ? "#ec1818ff" : "#2306ff",
                    opacity: v.inStock ? 1 : 0.6,
                    cursor: v.inStock ? "pointer" : "not-allowed",
                  }}
                  title={v.inStock ? "" : "Out of stock"}
                >
                  {formatSize(v.sizeGrams)} · {formatHuf(v.priceCents)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Option groups */}
      {product.optionGroups.map((g) => (
        <div key={g.id} style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            {g.name} {g.required ? "*" : ""}{" "}
            {g.type === "SINGLE" ? "(choose 1)" : ""}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {g.options.map((o) => {
              const active = (selected[g.id] || []).includes(o.id);
              return (
                <button
                  key={o.id}
                  onClick={() => toggle(g, o.id)}
                  className="my_button"
                  style={{ background: active ? "#ec1818ff" : "#2306ff" }}
                >
                  {o.label}
                  {o.priceDeltaCents ? ` +${formatHuf(o.priceDeltaCents)}` : ""}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Total */}
      <div style={{ marginTop: 12, fontSize: 18 }}>
        Total: <b>{formatHuf(totalCents)}</b>{" "}
        {activeVariant && (
          <span style={{ color: "#666" }}>
            · {formatSize(activeVariant.sizeGrams)}
          </span>
        )}
      </div>

      {/* Add to cart */}
      <button
        className="my_button"
        style={{ marginTop: 12, width: "100%" }}
        onClick={addToCart}
        disabled={!activeVariant}
      >
        Add to cart
      </button>
    </div>
  );
}
