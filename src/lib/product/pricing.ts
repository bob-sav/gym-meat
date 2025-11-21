// src/lib/product/pricing.ts
import type { NormalizedProduct } from "./types";

export const gramsToKg = (g: number) => g / 1000;

export function computeOptionDeltasCents(
  product: NormalizedProduct,
  optionIds: string[],
  sizeGrams: number
) {
  let fixed = 0;
  let perKg = 0;

  const groupsById = new Map(
    product.optionGroups.map((g) => [g.id, g] as const)
  );

  for (const id of optionIds) {
    const hit = product.byOptionId[id];
    if (!hit) continue;

    const group = groupsById.get(hit.groupId);
    const delta = hit.option.priceDeltaCents || 0;

    if (group?.perKg) {
      perKg += delta; // Ft/kg
    } else {
      fixed += delta; // Ft per unit
    }
  }

  const appliedPerKg = Math.round(perKg * gramsToKg(sizeGrams));
  return { fixed, perKg, appliedPerKg };
}

export function computeUnitPriceCents(
  product: NormalizedProduct,
  sizeGrams: number,
  optionIds: string[]
) {
  const v = product.variants.find((v) => v.sizeGrams === sizeGrams);
  if (!v) return 0;
  const { fixed, appliedPerKg } = computeOptionDeltasCents(
    product,
    optionIds,
    sizeGrams
  );
  return v.priceCents + fixed + appliedPerKg;
}

export function computeLineTotalsCents(
  product: NormalizedProduct,
  sizeGrams: number,
  optionIds: string[],
  qty: number
) {
  const unitCents = computeUnitPriceCents(product, sizeGrams, optionIds);
  return { unitCents, totalCents: unitCents * qty };
}
