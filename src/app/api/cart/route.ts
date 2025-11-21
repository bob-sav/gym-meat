// src/app/api/cart/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { clearCart, cartTotals, getCart, setCart } from "@/lib/cart";

const prisma = new PrismaClient();

const addSchema = z.object({
  productId: z.string().min(1),
  // NEW: variantId (but optional for backward-compat; we’ll default to first in-stock variant)
  variantId: z.string().min(1).optional(),
  optionIds: z.array(z.string().min(1)).optional().default([]),
  qty: z.number().int().positive().default(1),
});

// GET
export async function GET() {
  const cart = await getCart();
  const totals = cartTotals(cart);
  return NextResponse.json({ cart, totals });
}

// POST
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
      optionIds = [],
      qty,
    } = parsed.data;

    const p = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: { orderBy: [{ sortOrder: "asc" }, { sizeGrams: "asc" }] },
        optionGroups: {
          include: { options: { orderBy: { sortOrder: "asc" } } },
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

    // --- Variant pick ---
    const variant =
      (variantIdInput
        ? p.variants.find((v) => v.id === variantIdInput)
        : p.variants.find((v) => v.inStock)) ?? null;

    if (!variant) {
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

    // --- Build indices for group + options ---
    const groupMap = new Map(
      p.optionGroups.map((g) => [
        g.id,
        {
          id: g.id,
          name: g.name,
          type: g.type as "SINGLE" | "MULTIPLE",
          required: !!g.required,
          min: g.minSelect ?? 0,
          max: g.maxSelect ?? Infinity,
          options: g.options,
        },
      ])
    );

    type OptEntry = {
      id: string;
      groupId: string;
      label: string;
      priceDeltaCents: number;
      perKg: boolean;
    };

    const optionIndex = new Map<string, OptEntry>(
      p.optionGroups.flatMap((g) =>
        g.options.map((o) => [
          o.id,
          {
            id: o.id,
            groupId: g.id,
            label: o.label,
            priceDeltaCents: o.priceDeltaCents ?? 0,
            perKg: !!(g as any).perKg, // Prisma group has perKg boolean
          },
        ])
      )
    );

    // --- Start with valid user selections ---
    const validChosen = optionIds
      .map((id) => optionIndex.get(id) || null)
      .filter(Boolean) as OptEntry[];

    // Group them for constraint checks
    const byGroup = new Map<string, OptEntry[]>();
    for (const o of validChosen) {
      const arr = byGroup.get(o.groupId) || [];

      if (!arr.some((x) => x.id === o.id)) arr.push(o); // de-duplicate within a group
      byGroup.set(o.groupId, arr);
    }

    // Include MULTIPLE defaults (server-side too) and enforce constraints
    for (const g of p.optionGroups) {
      const meta = groupMap.get(g.id)!;
      const current = byGroup.get(g.id) || [];

      const defaults = g.options
        .filter((o) => o.isDefault)
        .map((o) => optionIndex.get(o.id)!)
        .filter(Boolean);

      // add defaults if missing
      for (const d of defaults) {
        if (!current.some((x) => x.id === d.id)) current.push(d);
      }

      if (meta.type === "SINGLE") {
        let keep: OptEntry | undefined = current[0];
        if (!keep && meta.required) {
          const def =
            defaults[0] ?? (g.options[0] && optionIndex.get(g.options[0].id)!);
          if (def) keep = def;
        }
        byGroup.set(g.id, keep ? [keep] : []);
      } else {
        let kept = current.slice(0, meta.max);
        if (kept.length < meta.min) {
          for (const d of defaults) {
            if (kept.length >= meta.min) break;
            if (!kept.some((x) => x.id === d.id)) kept.push(d);
          }
          kept = kept.slice(0, meta.max);
        }
        byGroup.set(g.id, kept);
      }
    }

    const chosen: Array<{
      optionId: string;
      groupId: string;
      label: string;
      priceDeltaCents: number;
      perKg: boolean;
    }> = Array.from(byGroup.values())
      .flat()
      .map((o) => ({
        optionId: o.id,
        groupId: o.groupId,
        label: o.label,
        priceDeltaCents: o.priceDeltaCents,
        perKg: o.perKg,
      }));

    // --- Build line ---
    const line = {
      id: crypto.randomUUID(),
      productId: p.id,
      name: p.name,
      unitLabel: `${(variant.sizeGrams / 1000).toFixed(2)} kg`,
      basePriceCents: variant.priceCents,
      variantSizeGrams: variant.sizeGrams,
      options: chosen,
      qty,
    };

    // --- Merge identical lines (same product, grams, same options set) ---
    const cart = await getCart();
    const keyOf = (l: typeof line) =>
      `${l.productId}|${l.variantSizeGrams}|${l.options
        .map((o) => o.optionId)
        .sort()
        .join(",")}`;

    const newKey = keyOf(line);
    const existing = cart.lines.find((l) => keyOf(l as any) === newKey);
    if (existing) {
      existing.qty += qty;
    } else {
      cart.lines.push(line as any);
    }

    const res = NextResponse.json({ cart, totals: cartTotals(cart) });
    setCart(res, cart);
    return res;
  } catch (e) {
    console.error("POST /api/cart failed", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE /api/cart (clear)
export async function DELETE() {
  const empty = { lines: [] };
  const res = NextResponse.json({ cart: empty, totals: cartTotals(empty) });
  setCart(res, empty);
  return res;
}
