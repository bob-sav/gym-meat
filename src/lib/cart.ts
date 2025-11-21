import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import type { Cart } from "@/lib/product/cart-types";
import {
  cartTotals as computeCartTotals,
  lineUnitTotalCents,
} from "@/lib/product/price";

const COOKIE = "cart_v1";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const CartSchema = z.object({
  lines: z.array(
    z.object({
      id: z.string(),
      productId: z.string(),
      name: z.string(),
      unitLabel: z.string(),
      basePriceCents: z.number().int().nonnegative(),
      qty: z.number().int().positive(),
      variantSizeGrams: z.number().int().positive().optional(),
      options: z.array(
        z.object({
          groupId: z.string(),
          optionId: z.string(),
          label: z.string(),
          priceDeltaCents: z.number().int().nonnegative(),
          perKg: z.boolean(),
        })
      ),
    })
  ),
}) satisfies z.ZodType<Cart>;

// NOTE: cookies() is async on Next 15
export async function getCart(): Promise<Cart> {
  const v = (await cookies()).get(COOKIE)?.value;
  if (!v) return { lines: [] };
  try {
    const parsed = JSON.parse(v);
    const safe = CartSchema.safeParse(parsed);
    return safe.success ? safe.data : { lines: [] };
  } catch {
    return { lines: [] };
  }
}

export function setCart(res: NextResponse, cart: Cart) {
  res.cookies.set({
    name: COOKIE,
    value: JSON.stringify(cart),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function cartTotals(cart: Cart) {
  return computeCartTotals(cart);
}

export { lineUnitTotalCents };

export function clearCart(res: NextResponse) {
  setCart(res, { lines: [] });
}
