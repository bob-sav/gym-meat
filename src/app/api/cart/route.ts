import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { cartTotals, getCart, setCart } from "@/lib/cart";

const prisma = new PrismaClient();

const addSchema = z.object({
  productId: z.string().min(1),
  // NEW: variantId (but optional for backward-compat; we’ll default to first in-stock variant)
  variantId: z.string().min(1).optional(),
  optionIds: z.array(z.string().min(1)).optional().default([]),
  qty: z.number().int().positive().default(1),
});

// GET /api/cart
export async function GET() {
  const cart = await getCart();
  const totals = cartTotals(cart);
  return NextResponse.json({ cart, totals });
}

// POST /api/cart  (add line)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = addSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      productId,
      variantId: variantIdInput,
      optionIds,
      qty,
    } = parsed.data;

    // Load product with variants & options
    const p = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: { orderBy: [{ sortOrder: "asc" }, { sizeGrams: "asc" }] },
        optionGroups: {
          include: { options: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!p)
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    if (p.active === false) {
      return NextResponse.json(
        { error: "Product is inactive" },
        { status: 409 }
      );
    }

    // Pick variant:
    // - If client sent a variantId, make sure it belongs to this product and is in stock
    // - Else pick the first in-stock variant (fallback so current UI keeps working)
    let variant =
      (variantIdInput
        ? p.variants.find((v) => v.id === variantIdInput)
        : p.variants.find((v) => v.inStock)) ?? null;

    if (!variant) {
      // as a last resort, allow first variant even if out of stock (but return a 409)
      if (p.variants.length === 0) {
        return NextResponse.json(
          { error: "No variants defined" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Selected variant is not available" },
        { status: 409 }
      );
    }
    if (!variant.inStock) {
      return NextResponse.json(
        { error: "Variant is out of stock" },
        { status: 409 }
      );
    }

    // Build a flat index of valid options keyed by optionId
    const optionIndex = new Map(
      p.optionGroups.flatMap((g) =>
        g.options.map((o) => [
          o.id,
          { groupId: g.id, label: o.label, priceDeltaCents: o.priceDeltaCents },
        ])
      )
    );

    // Keep only valid option ids and attach their details
    const chosen = (optionIds ?? [])
      .map((id) => {
        const d = optionIndex.get(id);
        return d
          ? {
              optionId: id,
              groupId: d.groupId,
              label: d.label,
              priceDeltaCents: d.priceDeltaCents,
            }
          : null;
      })
      .filter(Boolean) as {
      optionId: string;
      groupId: string;
      label: string;
      priceDeltaCents: number;
    }[];

    // Create line (note: unitLabel now derived from variant.sizeGrams)
    const line = {
      id: crypto.randomUUID(),
      productId: p.id,
      name: p.name,
      unitLabel: `${variant.sizeGrams}g`,
      basePriceCents: variant.priceCents,
      options: chosen,
      qty,
    };

    // Append to cookie cart
    const cart = await getCart();
    cart.lines.push(line);
    const res = NextResponse.json({ line });
    setCart(res, cart);
    return res;
  } catch (e) {
    console.error("POST /api/cart failed", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE /api/cart  (clear)
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  setCart(res, { lines: [] });
  return res;
}
