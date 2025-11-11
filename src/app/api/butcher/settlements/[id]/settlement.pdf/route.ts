export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";
import { auth } from "@/auth";
import { formatHuf } from "@/lib/format";
import { isSiteAdminEmail } from "@/lib/roles";
import { isButcherSettler } from "@/lib/butcher-auth";

const prisma = new PrismaClient();

function font(file: string) {
  return fs.readFileSync(path.join(process.cwd(), "public", "fonts", file));
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  // --- Auth: site admin OR butcher admin with SETTLEMENT role ---
  const session = await auth();
  const email = session?.user?.email ?? "";
  if (!email) return new Response("Unauthorized", { status: 401 });

  const allowed = isSiteAdminEmail(email) || (await isButcherSettler(email));
  if (!allowed) return new Response("Not found", { status: 404 });

  // --- Fetch the settlement and its orders ---
  const s = await prisma.butcherSettlement.findUnique({
    where: { id },
    include: {
      createdBy: { select: { email: true, name: true } },
      orders: {
        select: {
          id: true,
          shortCode: true,
          totalCents: true,
          createdAt: true,
        },
      },
    },
  });
  if (!s) return new Response("Not found", { status: 404 });

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  try {
    doc.registerFont("Body", font("Inter_18pt-Regular.ttf"));
    doc.registerFont("Bold", font("Inter_18pt-Bold.ttf"));
  } catch {}

  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((r) =>
    doc.on("end", () => r(Buffer.concat(chunks)))
  );

  // Header
  doc.font("Bold").fontSize(18).text("Butcher Settlement", { align: "right" });
  doc.font("Body").moveDown(0.5);
  doc.fontSize(10).text(`Settlement: ${s.id}`);
  doc.text(`Created: ${new Date(s.createdAt).toLocaleString()}`);
  if (s.createdBy?.email) doc.text(`Created by: ${s.createdBy.email}`);
  if (s.notes) doc.text(`Notes: ${s.notes}`);
  doc.moveDown();

  // Summary
  doc.fontSize(12).text(`Orders: ${s.orderCount}`);
  doc.text(`Total: ${formatHuf(s.totalCents)}`);
  doc.moveDown();

  // Table
  doc.fontSize(12).text("Orders:");
  doc.moveDown(0.5);
  doc.fontSize(10);
  const colX = [50, 250, 450]; // short code, date, total
  doc.text("Short code", colX[0], doc.y);
  doc.text("Date", colX[1], doc.y);
  doc.text("Total", colX[2], doc.y, { width: 100, align: "right" });
  doc.moveDown(0.2);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();

  for (const o of s.orders) {
    doc.moveDown(0.2);
    doc.text(`#${o.shortCode ?? o.id.slice(0, 8)}`, colX[0], doc.y);
    doc.text(new Date(o.createdAt).toLocaleString(), colX[1], doc.y);
    doc.text(formatHuf(o.totalCents || 0), colX[2], doc.y, {
      width: 100,
      align: "right",
    });
  }

  doc.moveDown(2);
  doc
    .fontSize(9)
    .fillColor("#666")
    .text("Automatically generated settlement summary.", { align: "center" });
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
      "Content-Disposition": `${disposition}; filename="butcher-settlement-${s.id}.pdf"`,
    },
  });
}
