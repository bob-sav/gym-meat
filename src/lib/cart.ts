import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export type CartOption = {
  groupId: string;
  optionId: string;
  label: string;
  priceDeltaCents: number;
};

export type CartLine = {
  id: string;
  productId: string;
  name: string;
  unitLabel: string;
  basePriceCents: number;
  options: CartOption[];
  qty: number;
};

export type Cart = { lines: CartLine[] };

const COOKIE = "cart_v1";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// NOTE: cookies() is async on Next 15
export async function getCart(): Promise<Cart> {
  const v = (await cookies()).get(COOKIE)?.value;
  if (!v) return { lines: [] };
  try {
    const parsed = JSON.parse(v) as Cart;
    return parsed?.lines ? parsed : { lines: [] };
  } catch {
    return { lines: [] };
  }
}

// Use NextResponse instance to set cookie
export function setCart(res: NextResponse, cart: Cart) {
  const payload = JSON.stringify(cart);
  res.cookies.set({
    name: COOKIE,
    value: payload,
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function lineUnitTotalCents(line: CartLine) {
  const addOns = line.options.reduce((s, o) => s + o.priceDeltaCents, 0);
  return line.basePriceCents + addOns;
}

export function lineTotalCents(line: CartLine) {
  return lineUnitTotalCents(line) * line.qty;
}

export function cartTotals(cart: Cart) {
  const subtotalCents = cart.lines.reduce((s, l) => s + lineTotalCents(l), 0);
  return { subtotalCents, totalCents: subtotalCents };
}
