// src/app/api/orders/[id]/settlement.pdf/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import PDFDocument from "pdfkit";
import { auth } from "@/auth";
import { formatHuf, formatDateBudapest } from "@/lib/format";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

function readPublicFont(file: string) {
  // public/ is available at runtime; process.cwd() points at project root when running with PM2/next start
  return fs.readFileSync(path.join(process.cwd(), "public", "fonts", file));
}

function isAdminEmail(email?: string | null) {
  const raw = process.env.ADMIN_EMAILS ?? "";
  const list = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return !!email && list.includes(email.toLowerCase());
}

// helper: is the current user a gym-admin for THIS order's pickup gym?
async function isGymAdminForOrder(
  order: { pickupGymId: string | null },
  email?: string | null
) {
  if (!order?.pickupGymId || !email) return false;
  const row = await prisma.gymAdmin.findFirst({
    where: { gymId: order.pickupGymId, user: { email } },
    select: { id: true },
  });
  return !!row;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  // resolve session -> currentUser (id/email)
  const session = await auth();
  const sessionId = (session?.user as any)?.id as string | undefined;
  const sessionEmail = session?.user?.email ?? undefined;
  if (!sessionId && !sessionEmail)
    return new Response("Unauthorized", { status: 401 });

  const currentUser = sessionId
    ? await prisma.user.findUnique({
        where: { id: sessionId },
        select: { id: true, email: true },
      })
    : await prisma.user.findUnique({
        where: { email: sessionEmail! },
        select: { id: true, email: true },
      });

  if (!currentUser) return new Response("Unauthorized", { status: 401 });

  // fetch order
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, name: true } },
      lines: true,
    },
  });
  if (!order) return new Response("Not found", { status: 404 });

  // auth: owner OR global admin OR gym-admin of this order's pickup gym
  const isOwner = order.userId === currentUser.id;
  const isAdmin = isAdminEmail(currentUser.email);
  const isGymAdmin = await isGymAdminForOrder(order, currentUser.email);

  if (!isOwner && !isAdmin && !isGymAdmin) {
    // hide existence details
    return new Response("Not found", { status: 404 });
  }

  // --- Vendor detection (no migration required) ---
  const sellerType: "GYM" | "BUTCHER" =
    (order as any).sellerType ??
    (order.pickupGymId || order.pickupGymName ? "GYM" : "BUTCHER");

  const sellerTitle = sellerType === "GYM" ? "Gym Meat" : "Butcher";
  const pickupTitle = sellerType === "GYM" ? "Pickup (Gym)" : "Pickup";

  // --- Build PDF in-memory ---
  const doc = new PDFDocument({ size: "A4", margin: 50 });

  // ✅ register and select your own fonts BEFORE any text calls
  try {
    const body = readPublicFont("Inter_18pt-Regular.ttf");
    const bold = readPublicFont("Inter_18pt-Bold.ttf");
    doc.registerFont("Body", body);
    doc.registerFont("Bold", bold);
    doc.font("Body");
  } catch {
    // If fonts are missing, still set a fallback (avoids Helvetica load on first text)
    // You can skip this catch if you're sure the files exist.
  }

  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) =>
    doc.on("end", () => resolve(Buffer.concat(chunks)))
  );

  // Use Bold for headings, Body elsewhere
  doc.font("Bold").fontSize(18).text("Settlement", { align: "right" });
  doc.font("Body");
  doc.moveDown(0.5);

  doc.fontSize(10).text(`Order: ${order.shortCode ?? order.id}`);
  doc.text(`Date: ${formatDateBudapest(order.createdAt)}`);
  if (order.pickupGymName) doc.text(`${pickupTitle}: ${order.pickupGymName}`);
  if (order.pickupWhen) {
    doc.text(`Pickup time: ${formatDateBudapest(order.pickupWhen as any)}`);
  }
  doc.moveDown();

  // Parties
  doc.fontSize(12).text(`Seller: ${sellerTitle}`);
  const buyer =
    order.user?.name && order.user?.email
      ? `${order.user.name} <${order.user.email}>`
      : order.user?.email || `User ${order.userId}`;
  doc.text(`Buyer: ${buyer}`);
  doc.moveDown();

  if (order.notes) {
    doc.fontSize(10).fillColor("#444").text(`Notes: ${order.notes}`);
    doc.fillColor("#000");
    doc.moveDown();
  }

  // Table
  doc.fontSize(12).text("Items:");
  doc.moveDown(0.5);
  doc.fontSize(10);
  const colX = [50, 300, 390, 475]; // name, qty, unit, total
  doc.text("Product", colX[0], doc.y);
  doc.text("Qty", colX[1], doc.y, { width: 60, align: "right" });
  doc.text("Unit price", colX[2], doc.y, { width: 70, align: "right" });
  doc.text("Total", colX[3], doc.y, { width: 70, align: "right" });
  doc.moveDown(0.2);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();

  let computedCents = 0;
  for (const it of order.lines) {
    const lineTotalCents = it.basePriceCents * it.qty;
    computedCents += lineTotalCents;

    doc.moveDown(0.2);
    const unitLbl = it.unitLabel ? ` (${it.unitLabel})` : "";
    doc.text(`${it.productName}${unitLbl}`, colX[0], doc.y, {
      width: colX[1] - colX[0] - 10,
    });

    doc.text(String(it.qty), colX[1], doc.y, { width: 60, align: "right" });
    doc.text(formatHuf(it.basePriceCents), colX[2], doc.y, {
      width: 70,
      align: "right",
    });
    doc.text(formatHuf(lineTotalCents), colX[3], doc.y, {
      width: 70,
      align: "right",
    });
  }

  doc.moveDown();
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.5);

  const subtotalTxt =
    order.subtotalCents != null
      ? formatHuf(order.subtotalCents)
      : formatHuf(computedCents);
  const totalTxt =
    order.totalCents != null ? formatHuf(order.totalCents) : subtotalTxt;

  doc.fontSize(12).text(`Subtotal: ${subtotalTxt}`, { align: "right" });
  doc.text(`Total: ${totalTxt}`, { align: "right" });

  doc.moveDown(2);
  doc
    .fontSize(9)
    .fillColor("#666")
    .text("This is an automatically generated settlement.", {
      align: "center",
    });
  doc.fillColor("#000");

  doc.end();
  const pdf = await done;

  const url = new URL(req.url);
  const disposition =
    url.searchParams.get("download") === "1" ? "attachment" : "inline";

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      // "Content-Disposition": `inline; filename="settlement-${order.shortCode ?? order.id}.pdf"`,
      "Content-Disposition": `${disposition}; filename="settlement-${order.shortCode ?? order.id}.pdf"`,
    },
  });
}
