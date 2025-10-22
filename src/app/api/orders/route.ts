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
  pickupWhen: z.string().datetime().optional(), // ISO
  notes: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Require login
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!user)
      return NextResponse.json({ error: "User missing" }, { status: 400 });

    // Parse body
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { pickupGymId, pickupGymName, pickupWhen, notes } = parsed.data;

    // Read cart
    const cart = await getCart(); // our cookie-based cart
    if (!cart.lines.length) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }
    const totals = cartTotals(cart);

    // Create shortCode with collision retry (unique in DB)
    let shortCode = generateShortCode(6);
    for (let i = 0; i < 5; i++) {
      const exists = await prisma.order.findUnique({ where: { shortCode } });
      if (!exists) break;
      shortCode = generateShortCode(6);
    }

    // Create order + lines
    const created = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId: user.id,
          shortCode,
          state: "PENDING",
          pickupGymId: pickupGymId ?? null,
          pickupGymName: pickupGymName ?? null,
          pickupWhen: pickupWhen ? new Date(pickupWhen) : null,
          subtotalCents: totals.subtotalCents,
          totalCents: totals.totalCents,
          notes: notes ?? null,
        },
      });

      // join each line to a Product (best-effort)
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

    // Clear cart
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
  } catch (e) {
    console.error("POST /api/orders failed", e);
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
