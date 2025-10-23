import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getCart, setCart, cartTotals } from "@/lib/cart";
import { generateShortCode } from "@/lib/shortcode";
import { z } from "zod";
import { auth } from "@/auth"; // your NextAuth export

const prisma = new PrismaClient();

const createSchema = z.object({
  pickupGymId: z.string().min(1).optional(),
  pickupGymName: z.string().min(1).optional(),
  pickupWhen: z.string().datetime({ offset: true }).optional(), // ISO if we get date without timezone
  notes: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User missing" }, { status: 400 });
    }

    // Parse body and normalize fields
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    // Normalize empty strings to undefined
    const pickupGymId =
      typeof body.pickupGymId === "string" && body.pickupGymId.trim() !== ""
        ? body.pickupGymId.trim()
        : undefined;
    const pickupGymName =
      typeof body.pickupGymName === "string" && body.pickupGymName.trim() !== ""
        ? body.pickupGymName.trim()
        : undefined;
    const notes =
      typeof body.notes === "string" && body.notes.trim() !== ""
        ? body.notes.trim()
        : undefined;

    // Accept ISO or datetime-local and coerce safely
    let pickupWhen: Date | null = null;
    if (typeof body.pickupWhen === "string" && body.pickupWhen.trim() !== "") {
      // datetime-local comes like "2025-10-23T19:00"
      const raw = body.pickupWhen.trim();
      // If missing timezone/seconds, just construct Date(raw) (interpreted in local)
      const d = new Date(raw);
      if (isNaN(d.getTime())) {
        return NextResponse.json(
          { error: "Invalid pickupWhen date format" },
          { status: 400 }
        );
      }
      pickupWhen = d;
    }

    // Read cart
    const cart = await getCart();
    if (!cart.lines.length) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }
    const totals = cartTotals(cart);

    // Short code with a couple retries
    let shortCode = generateShortCode(6);
    for (let i = 0; i < 3; i++) {
      const exists = await prisma.order.findUnique({ where: { shortCode } });
      if (!exists) break;
      shortCode = generateShortCode(6);
    }

    const created = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId: user.id,
          shortCode,
          state: "PENDING",
          pickupGymId: pickupGymId ?? null,
          pickupGymName: pickupGymName ?? null,
          pickupWhen,
          subtotalCents: totals.subtotalCents,
          totalCents: totals.totalCents,
          notes: notes ?? null,
        },
      });

      // Persist lines
      for (const line of cart.lines) {
        const prod = await tx.product.findUnique({
          where: { id: line.productId },
          select: { id: true, species: true, part: true },
        });

        await tx.orderLine.create({
          data: {
            orderId: order.id,
            productId: prod?.id ?? line.productId,
            productName: line.name,
            species: (prod?.species as any) ?? "OTHER",
            part: (prod?.part as any) ?? null,
            variantSizeGrams: null,
            unitLabel: line.unitLabel ?? null,
            basePriceCents: line.basePriceCents,
            optionsJson: line.options ?? [],
            qty: line.qty,
          } as any,
        });
      }

      return order;
    });

    // Clear cart & return summary
    const res = NextResponse.json({
      order: {
        id: created.id,
        shortCode: created.shortCode,
        state: created.state,
        totalCents: created.totalCents,
        pickupGymName: created.pickupGymName,
      },
    });
    setCart(res, { lines: [] });
    return res;
  } catch (e: any) {
    // Improve server-side visibility
    console.error("POST /api/orders failed:", e?.stack || e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// (Optional) GET your own orders
export async function GET() {
  const session = await (auth as any)();
  if (!session?.user?.email) {
    return NextResponse.json({ items: [] });
  }
  const u = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!u) return NextResponse.json({ items: [] });

  const items = await prisma.order.findMany({
    where: { userId: u.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      shortCode: true,
      state: true,
      totalCents: true,
      pickupGymName: true,
      pickupWhen: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ items });
}
