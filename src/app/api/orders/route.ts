// src/app/api/orders/route.ts

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getCart, setCart, cartTotals, lineUnitTotalCents } from "@/lib/cart";
import { linePublicPerKgCents } from "@/lib/product/price";
import type { CartLine, CartOption } from "@/lib/product/cart-types";
import { generateShortCode } from "@/lib/shortcode";
import { auth } from "@/auth";
import { sendEmail } from "@/lib/mails";
import { orderConfirmationHtml } from "@/lib/emailTemplates";

const prisma = new PrismaClient();

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

    // Resolve gym name server-side if we have an ID
    let resolvedPickupGymName: string | null = null;
    if (pickupGymId) {
      const gym = await prisma.gym.findUnique({
        where: { id: pickupGymId },
        select: { name: true },
      });
      resolvedPickupGymName = gym?.name ?? null;
    }

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
          pickupGymName: resolvedPickupGymName ?? pickupGymName ?? null,
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
            variantSizeGrams: line.variantSizeGrams ?? null,
            unitLabel: line.unitLabel ?? null,
            basePriceCents: line.basePriceCents,
            optionsJson: line.options ?? [],
            qty: line.qty,
          } as any,
        });
      }

      return order;
    });

    // 4) Fetch lines for the email with enough info to compute amounts
    const emailLinesRaw = await prisma.orderLine.findMany({
      where: { orderId: created.id },
      select: {
        qty: true,
        productName: true,
        unitLabel: true,
        basePriceCents: true,
        variantSizeGrams: true,
        optionsJson: true,
        species: true,
        part: true,
      },
      orderBy: { id: "asc" },
    });

    type EmailLine = {
      qty: number;
      name: string;
      unit: string | null;
      unitCents: number;
      totalCents: number;
      species: string;
      part: string | null;
      prepLabels: string[];
      publicPerKgCents: number;
    };

    const emailLines: EmailLine[] = emailLinesRaw.map((l) => {
      const options = (l.optionsJson as any[]) ?? [];

      const lineForMath = {
        id: "email",
        productId: "email",
        name: l.productName,
        unitLabel: l.unitLabel ?? null,
        basePriceCents: l.basePriceCents,
        variantSizeGrams: l.variantSizeGrams ?? null,
        options,
        qty: l.qty,
      };

      const unitCents = lineUnitTotalCents(lineForMath as any);
      const publicPerKgCents = linePublicPerKgCents(lineForMath as any);

      const prepLabels =
        options
          .map((op) => op?.label as string | undefined)
          .filter(
            (label): label is string => !!label && typeof label === "string"
          ) ?? [];

      return {
        qty: l.qty,
        name: l.productName,
        unit: l.unitLabel,
        unitCents,
        totalCents: unitCents * l.qty,
        species: String(l.species),
        part: l.part ? String(l.part) : null,
        prepLabels,
        publicPerKgCents,
      };
    });

    // 6) Send email with explicit totals (+ richer line data if template wants it)
    try {
      await sendEmail({
        to: session.user.email!,
        subject: `Order #${created.shortCode} received`,
        html: orderConfirmationHtml({
          shortCode: created.shortCode,
          pickupGymName: created.pickupGymName,
          pickupWhen: created.pickupWhen,
          lines: emailLines,
          totalCents: created.totalCents,
          recipientName: session.user.name,
        }),
      });
    } catch (e) {
      console.error("Email(order-confirmation) failed:", e);
    }

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
  if (!session?.user?.email) return NextResponse.json({ items: [] });

  const u = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!u) return NextResponse.json({ items: [] });

  const orders = await prisma.order.findMany({
    where: { userId: u.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      shortCode: true,
      state: true,
      subtotalCents: true,
      totalCents: true,
      pickupGymName: true,
      pickupWhen: true,
      createdAt: true,
      lines: {
        select: {
          id: true,
          productName: true,
          qty: true,
          unitLabel: true,
          basePriceCents: true,
          species: true,
          part: true,
          variantSizeGrams: true,
          optionsJson: true,
        },
        orderBy: { id: "asc" },
      },
    },
  });

  type StoredOpt = {
    label: string;
    priceDeltaCents?: number;
    perKg?: boolean;
    priceDeltaPerKgCents?: number; // legacy
    groupId?: string;
    optionId?: string;
  };

  const items = orders.map((o) => {
    const lines = o.lines.map((l) => {
      const storedOptions = (l.optionsJson as unknown as StoredOpt[]) ?? [];

      const options: CartOption[] = storedOptions.map((op, idx) => {
        const legacyPerKg =
          typeof op.priceDeltaPerKgCents === "number" &&
          op.priceDeltaPerKgCents !== 0;

        const perKg = typeof op.perKg === "boolean" ? op.perKg : legacyPerKg;

        const priceDeltaCents =
          typeof op.priceDeltaCents === "number"
            ? op.priceDeltaCents
            : legacyPerKg
              ? (op.priceDeltaPerKgCents ?? 0)
              : 0;

        return {
          groupId: op.groupId ?? `legacy-group-${idx}`,
          optionId: op.optionId ?? `legacy-opt-${idx}`,
          label: op.label ?? "",
          priceDeltaCents,
          perKg,
        };
      });

      const lineForMath: CartLine = {
        id: l.id,
        productId: o.id,
        name: l.productName,
        unitLabel: l.unitLabel ?? "",
        basePriceCents: l.basePriceCents,
        qty: l.qty,
        variantSizeGrams: l.variantSizeGrams ?? undefined,
        options,
      };

      const unitTotalCents = lineUnitTotalCents(lineForMath);
      const lineTotalCents = unitTotalCents * l.qty;

      return {
        ...l,
        options, // normalized options
        unitTotalCents,
        lineTotalCents,
      };
    });

    const derivedSubtotal = lines.reduce((s, li) => s + li.lineTotalCents, 0);

    return {
      ...o,
      subtotalCents: o.subtotalCents ?? derivedSubtotal,
      totalCents: o.totalCents ?? derivedSubtotal,
      derivedSubtotalCents: derivedSubtotal,
      lines,
    };
  });

  return NextResponse.json({ items });
}
