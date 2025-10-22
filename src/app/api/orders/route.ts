// src/app/api/orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { getCart, cartTotals, setCart } from "@/lib/cart";
import { generateShortCode } from "@/lib/shortcode"; // 6-digit code

const prisma = new PrismaClient();

const createOrderSchema = z.object({
  pickupGymName: z.string().min(1, "pickupGymName is required"),
  // Optional, ISO datetime string for planned pickup time
  pickupWhen: z.string().datetime().optional(),
});

// GET /api/orders (optional simple self-check / future list)
export async function GET() {
  return NextResponse.json({ ok: true });
}

// POST /api/orders
export async function POST(req: NextRequest) {
  try {
    // Must be authenticated
    const userId = (req as any).auth?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { pickupGymName, pickupWhen } = parsed.data;

    // Load cart from cookie
    const cart = await getCart();
    if (!cart.lines.length) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    // Compute totals from cart snapshot
    const totals = cartTotals(cart);
    const shortCode = generateShortCode(); // e.g. 6-digit human-friendly

    // Persist order + lines atomically
    const created = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          shortCode,
          state: "PENDING",
          totalCents: totals.totalCents,
          pickupGymName,
          pickupWhen: pickupWhen ? new Date(pickupWhen) : null,
          userId, // if your Order model has userId; omit if not
        } as any,
      });

      // Insert lines
      for (const line of cart.lines) {
        // unit price = base + options
        const optionTotal = line.options.reduce(
          (s, o) => s + (o.priceDeltaCents || 0),
          0
        );
        const unitPriceCents = line.basePriceCents + optionTotal;

        // Try to capture grams from line if present; else parse from unitLabel "250g"
        let variantSizeGrams: number | null =
          (line as any).variantSizeGrams ?? null;
        if (variantSizeGrams == null && line.unitLabel) {
          const m = /(\d+)\s*g/i.exec(line.unitLabel);
          if (m) variantSizeGrams = parseInt(m[1], 10);
        }

        await tx.orderLine.create({
          data: {
            orderId: order.id,
            productId: line.productId,
            productName: line.name,
            variantSizeGrams: variantSizeGrams ?? 0, // store 0 if unknown
            unitPriceCents,
            qty: line.qty,
            optionsJson: line.options, // JSON snapshot
          } as any,
        });
      }

      return order;
    });

    // Clear cart cookie after success
    const res = NextResponse.json({
      order: {
        id: created.id,
        shortCode: created.shortCode,
        state: created.state,
        totalCents: created.totalCents,
        pickupGymName: created.pickupGymName,
        pickupWhen: created.pickupWhen,
      },
    });
    setCart(res, { lines: [] });
    return res;
  } catch (err) {
    console.error("POST /api/orders failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
