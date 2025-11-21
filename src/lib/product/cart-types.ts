// src/lib/product/cart-types.ts
export type CartOption = {
  groupId: string;
  optionId: string;
  label: string;
  priceDeltaCents: number;
  perKg: boolean;
};

export type CartLine = {
  id: string;
  productId: string;
  name: string;
  unitLabel: string; // e.g. "500g" or "1.00 kg" (we try to parse grams)
  basePriceCents: number; // variant price
  options: CartOption[];
  qty: number;
  variantSizeGrams?: number; // preferred weight source
};

export type Cart = { lines: CartLine[] };
