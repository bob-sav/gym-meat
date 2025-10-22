import { NextRequest, NextResponse } from "next/server";
import { getCart, setCart } from "@/lib/cart";
import { z } from "zod";

const qtySchema = z.object({ qty: z.number().int().positive() });

// PATCH /api/cart/[lineId]  -> update qty
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ lineId: string }> }
) {
  const { lineId } = await ctx.params;
  try {
    const body = await req.json();
    const parsed = qtySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const cart = await getCart();
    const idx = cart.lines.findIndex((l) => l.id === lineId);
    if (idx < 0)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    cart.lines[idx].qty = parsed.data.qty;

    const res = NextResponse.json({ line: cart.lines[idx] });
    setCart(res, cart);
    return res;
  } catch (e) {
    console.error("PATCH /api/cart/[lineId] failed", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE /api/cart/[lineId]
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ lineId: string }> }
) {
  const { lineId } = await ctx.params;
  const cart = await getCart();
  const nextLines = cart.lines.filter((l) => l.id !== lineId);
  const res = new NextResponse(null, { status: 204 });
  setCart(res, { lines: nextLines });
  return res;
}
