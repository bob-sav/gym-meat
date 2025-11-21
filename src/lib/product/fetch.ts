// src/lib/product/fetch.ts
import { normalizeProduct } from "./normalize";
import type { NormalizedProduct, ProductDTO } from "./types";

export async function fetchProductsNormalized(): Promise<NormalizedProduct[]> {
  const r = await fetch("/api/products?normalized=1", { cache: "no-store" });
  const j = await r.json();
  return (j.items as ProductDTO[]).map(normalizeProduct);
}
