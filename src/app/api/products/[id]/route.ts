import { NextResponse, NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

// Runtime enums for Zod
const SpeciesValues = [
  "BEEF",
  "CHICKEN",
  "TURKEY",
  "DUCK",
  "GOOSE",
  "SALMON",
  "OTHER",
] as const;

const PartValues = [
  "SIRLOIN",
  "RIBEYE",
  "TENDERLOIN",
  "RUMP",
  "SHORT_LOIN",
  "BREAST",
  "THIGH",
  "WHOLE_BIRD",
  "FILLET",
  "OTHER",
] as const;

const OptionGroupTypeValues = ["SINGLE", "MULTIPLE"] as const;

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  species: z.enum(SpeciesValues).optional(),
  part: z.enum(PartValues).nullable().optional(),
  description: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  active: z.boolean().optional(),

  // Full replace of option groups (same behavior you had)
  optionGroups: z
    .array(
      z.object({
        name: z.string().min(1),
        type: z.enum(OptionGroupTypeValues),
        required: z.boolean().default(false),
        minSelect: z.number().int().min(0).nullable().optional(),
        maxSelect: z.number().int().min(0).nullable().optional(),
        sortOrder: z.number().int().nonnegative().default(0),
        options: z
          .array(
            z.object({
              label: z.string().min(1),
              priceDeltaCents: z.number().int().nonnegative().default(0),
              isDefault: z.boolean().default(false),
              sortOrder: z.number().int().nonnegative().default(0),
            })
          )
          .default([]),
      })
    )
    .optional(),
});

// GET /api/products/[id]
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const item = await prisma.product.findUnique({
    where: { id },
    include: {
      variants: { orderBy: [{ sortOrder: "asc" }, { sizeGrams: "asc" }] },
      optionGroups: {
        orderBy: { sortOrder: "asc" },
        include: { options: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item });
}

// PUT /api/products/[id]
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const d = parsed.data;

    // Only map top-level fields that exist on the new Product model
    const data: any = {};
    for (const k of [
      "name",
      "species",
      "part",
      "description",
      "imageUrl",
      "active",
    ] as const) {
      if (k in d) (data as any)[k] = (d as any)[k];
    }

    const res = await prisma.$transaction(async (tx) => {
      // Replace option groups if provided (same semantics as before)
      if (d.optionGroups) {
        await tx.productOption.deleteMany({
          where: { group: { productId: id } },
        });
        await tx.productOptionGroup.deleteMany({ where: { productId: id } });

        for (const g of d.optionGroups) {
          const group = await tx.productOptionGroup.create({
            data: {
              productId: id,
              name: g.name,
              type: g.type as any,
              required: g.required ?? false,
              minSelect: g.minSelect ?? null,
              maxSelect: g.maxSelect ?? null,
              sortOrder: g.sortOrder ?? 0,
            },
          });
          if (g.options?.length) {
            await tx.productOption.createMany({
              data: g.options.map((o) => ({
                groupId: group.id,
                label: o.label,
                priceDeltaCents: o.priceDeltaCents ?? 0,
                isDefault: o.isDefault ?? false,
                sortOrder: o.sortOrder ?? 0,
              })),
            });
          }
        }
      }

      if (Object.keys(data).length > 0) {
        await tx.product.update({ where: { id }, data });
      }

      return tx.product.findUnique({
        where: { id },
        include: {
          variants: { orderBy: [{ sortOrder: "asc" }, { sizeGrams: "asc" }] },
          optionGroups: { include: { options: true } },
        },
      });
    });

    if (!res) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ item: res });
  } catch (e) {
    console.error("PUT /api/products/[id] failed", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE /api/products/[id]
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  try {
    await prisma.product.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (e: any) {
    if (e?.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("DELETE /api/products/[id] failed", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
