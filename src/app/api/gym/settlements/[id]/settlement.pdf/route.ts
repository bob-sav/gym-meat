// src/app/api/gym/settlements/[id]/settlement.pdf/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";
import { auth } from "@/auth";
import { formatHuf } from "@/lib/format";

const prisma = new PrismaClient();

// add near the top with other helpers
function isAdminEmail(email?: string | null) {
  const raw = process.env.ADMIN_EMAILS ?? "";
  const list = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return !!email && list.includes(email.toLowerCase());
}

async function isGymAdminOfGymId(
  gymId: string | null | undefined,
  email?: string | null
) {
  if (!gymId || !email) return false;
  const row = await prisma.gymAdmin.findFirst({
    where: { gymId, user: { email } },
    select: { id: true },
  });
  return !!row;
}

function font(file: string) {
  return fs.readFileSync(path.join(process.cwd(), "public", "fonts", file));
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const session = await auth();
  const email = session?.user?.email ?? "";
  if (!email) return new Response("Unauthorized", { status: 401 });

  // Load the settlement (include relations, and keep scalar fields like gymId)
  const s = await prisma.gymSettlement.findUnique({
    where: { id },
    include: {
      gym: { select: { id: true, name: true } },
      createdBy: { select: { id: true, email: true, name: true } },
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

  // Auth: global admin OR gym-admin of this settlement's gym (optionally creator)
  const admin = isAdminEmail(email);
  const gymAdmin = await isGymAdminOfGymId(s.gymId, email);
  // const creator = s.createdBy?.email?.toLowerCase() === email.toLowerCase(); // optional

  if (!admin && !gymAdmin /* && !creator */) {
    return new Response("Not found", { status: 404 }); // conceal existence
  }

  // PDF
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
  doc.font("Bold").fontSize(18).text("Gym Settlement", { align: "right" });
  doc.font("Body").moveDown(0.5);
  doc.fontSize(10).text(`Settlement: ${s.id}`);
  if (s.gym?.name) doc.text(`Gym: ${s.gym.name}`);
  doc.text(`Created: ${new Date(s.createdAt).toLocaleString()}`);
  if (s.createdBy?.email) doc.text(`Created by: ${s.createdBy.email}`);
  doc.moveDown();

  // Summary
  const count = s.orders.length;
  const totalCents = s.orders.reduce((s, o) => s + (o.totalCents || 0), 0);
  doc.fontSize(12).text(`Orders: ${count}`);
  doc.text(`Total: ${formatHuf(totalCents)}`);
  doc.moveDown();

  // Table (short list)
  doc.fontSize(12).text("Orders:");
  doc.moveDown(0.5);
  doc.fontSize(10);
  const colX = [50, 250, 450]; // shortCode, date, total
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
      "Content-Disposition": `${disposition}; filename="gym-settlement-${s.id}.pdf"`,
    },
  });
}
