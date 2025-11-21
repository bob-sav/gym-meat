// src/lib/product/price.ts
import type { Cart, CartLine, CartOption } from "./cart-types";

/** Parse "500g" or "1.00 kg" => grams (ints). Fallback: 0 */
export function parseUnitLabelToGrams(unitLabel?: string | null): number {
  if (!unitLabel) return 0;
  const g = unitLabel.match(/(\d+(?:\.\d+)?)\s*g/i);
  if (g) return Math.round(parseFloat(g[1]));
  const kg = unitLabel.match(/(\d+(?:\.\d+)?)\s*kg/i);
  if (kg) return Math.round(parseFloat(kg[1]) * 1000);
  return 0;
}

/** Fixed add-ons per unit (cents, non-perKg options only) */
export function sumFixedAdd(
  options: Pick<CartOption, "priceDeltaCents" | "perKg">[]
) {
  return options.reduce(
    (s, o) => s + (!o.perKg ? (o.priceDeltaCents ?? 0) : 0),
    0
  );
}

/** Per-kg add-ons applied to a weight in grams (rounded to cents) */
export function appliedPerKgCents(
  grams: number,
  options: Pick<CartOption, "priceDeltaCents" | "perKg">[]
) {
  const perKgSum = options.reduce(
    (s, o) => s + (o.perKg ? (o.priceDeltaCents ?? 0) : 0),
    0
  );
  const kg = grams / 1000;
  return Math.round(perKgSum * kg);
}

/** Unit total for a cart line (base + fixed + per-kg) */
export function lineUnitTotalCents(line: CartLine) {
  const grams =
    line.variantSizeGrams ?? parseUnitLabelToGrams(line.unitLabel) ?? 0;
  const fixed = sumFixedAdd(line.options);
  const perKg = appliedPerKgCents(grams, line.options);
  return line.basePriceCents + fixed + perKg;
}

export function lineTotalCents(line: CartLine) {
  return lineUnitTotalCents(line) * line.qty;
}

/** Totals for a cart */
export function cartTotals(cart: Cart) {
  const subtotalCents = cart.lines.reduce((s, l) => s + lineTotalCents(l), 0);
  return { subtotalCents, totalCents: subtotalCents };
}
