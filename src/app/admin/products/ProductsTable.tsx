"use client";

import { useEffect, useState } from "react";
import { formatHuf } from "@/lib/format";

type Variant = {
  sizeGrams: number;
  priceCents: number;
  inStock?: boolean;
  sortOrder?: number;
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
  active: boolean;
  createdAt: string;
  variants: Variant[];
};

function summarizeVariants(vs: Variant[]) {
  if (!vs?.length)
    return { sizes: "—", prices: "—", count: 0, inStockCount: 0 };

  const sizes = vs.map((v) => v.sizeGrams).sort((a, b) => a - b);
  const prices = vs.map((v) => v.priceCents).sort((a, b) => a - b);
  const minSize = sizes[0];
  const maxSize = sizes[sizes.length - 1];
  const minPrice = prices[0];
  const maxPrice = prices[prices.length - 1];
  const inStockCount = vs.filter((v) => v.inStock !== false).length;

  return {
    sizes: minSize === maxSize ? `${minSize} g` : `${minSize}–${maxSize} g`,
    prices:
      minPrice === maxPrice
        ? formatHuf(minPrice)
        : `${formatHuf(minPrice)}–${formatHuf(maxPrice)}`,
    count: vs.length,
    inStockCount,
  };
}

export default function ProductsTable() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/products", { cache: "no-store" });
      const j = await r.json();
      setItems(j.items || []);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onDelete(id: string) {
    if (!confirm("Delete this product?")) return;
    const r = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (!r.ok && r.status !== 204) {
      alert("Delete failed");
      return;
    }
    await load();
  }

  // Rename-only quick edit (safe regardless of PUT validator)
  async function onQuickEdit(p: Product) {
    const name = prompt("Name:", p.name);
    if (name === null) return;

    const isActive = confirm("Active?  OK = Yes,  Cancel = No");
    const body = { name: name.trim(), active: isActive };
    const r = await fetch(`/api/products/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert("Update failed: " + (j?.error ?? r.statusText));
      return;
    }
    await load();
  }

  if (loading) return <div>Loading products…</div>;
  if (err) return <div style={{ color: "crimson" }}>Error: {err}</div>;
  if (!items.length) return <div>No products yet.</div>;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
            <th style={{ padding: 8 }}>Name</th>
            <th style={{ padding: 8 }}>Species</th>
            <th style={{ padding: 8 }}>Sizes</th>
            <th style={{ padding: 8 }}>Prices</th>
            <th style={{ padding: 8 }}>Variants</th>
            <th style={{ padding: 8 }}>Active</th>
            <th style={{ padding: 8, width: 220 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => {
            const sum = summarizeVariants(p.variants || []);
            return (
              <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: 8 }}>{p.name}</td>
                <td style={{ padding: 8 }}>{p.species}</td>
                <td style={{ padding: 8 }}>{sum.sizes}</td>
                <td style={{ padding: 8 }}>{sum.prices}</td>
                <td style={{ padding: 8 }}>
                  {sum.count} total · {sum.inStockCount} in stock
                </td>
                <td style={{ padding: 8 }}>{p.active ? "✅" : "❌"}</td>
                <td style={{ padding: 8, display: "flex", gap: 8 }}>
                  <button className="my_button" onClick={() => onQuickEdit(p)}>
                    Quick edit
                  </button>
                  <button className="my_button" onClick={() => onDelete(p.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
        (Gyors név szerkesztés itt. Részletes szerkesztés—variánsok és
        opciók—később jön.)
      </div>
    </div>
  );
}
