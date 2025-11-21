// src/lib/product/normalize.ts
import type { NormalizedProduct, ProductDTO } from "./types";

function formatSizeLabel(sizeGrams: number): string {
  // keep grams as the source of truth; only format for display
  if (sizeGrams % 1000 === 0) {
    return `${sizeGrams / 1000} kg`;
  }
  return `${sizeGrams} g`;
}

export function normalizeProduct(p: ProductDTO): NormalizedProduct {
  const variants = [...(p.variants || [])]
    .map((v) => ({
      ...v,
      priceCents: v.priceCents ?? 0,
      sizeLabel: v.sizeLabel ?? formatSizeLabel(v.sizeGrams),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.sizeGrams - b.sizeGrams);

  const optionGroups = [...(p.optionGroups || [])]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((g) => ({
      ...g,
      perKg: !!g.perKg,
      options: [...g.options]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((o) => ({
          ...o,
          priceDeltaCents: o.priceDeltaCents ?? 0,
        })),
    }));

  const byOptionId: NormalizedProduct["byOptionId"] = {};
  const defaultSingleSelections: Record<string, string> = {};

  for (const g of optionGroups) {
    for (const o of g.options) {
      byOptionId[o.id] = { groupId: g.id, option: o };
    }
    if (g.type === "SINGLE") {
      const def = g.options.find((o) => o.isDefault) ?? g.options[0];
      if (def) defaultSingleSelections[g.id] = def.id;
    }
  }

  return {
    ...p,
    variants,
    optionGroups,
    byOptionId,
    defaultSingleSelections,
    allowedSizes: variants.map((v) => v.sizeGrams),
  };
}
