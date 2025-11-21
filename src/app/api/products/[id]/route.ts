// src/app/api/products/[id]/route.ts
import { NextResponse, NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/auth";
import { isSiteAdminEmail } from "@/lib/roles";

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

const variantUpdateSchema = z.array(
  z.object({
    id: z.string().optional(),
    sizeGrams: z.number().int().positive(),
    priceCents: z.number().int().nonnegative(),
    sku: z.string().trim().min(1).optional().nullable(),
    inStock: z.boolean().optional(),
    sortOrder: z.number().int().nonnegative().optional(),
  })
);

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  species: z.enum(SpeciesValues).optional(),
  part: z.enum(PartValues).nullable().optional(),
  description: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  active: z.boolean().optional(),
  optionGroups: z
    .array(
      z.object({
        name: z.string().min(1),
        type: z.enum(OptionGroupTypeValues),
        required: z.boolean().default(false),
        minSelect: z.number().int().min(0).nullable().optional(),
        maxSelect: z.number().int().min(0).nullable().optional(),
        sortOrder: z.number().int().nonnegative().default(0),
        perKg: z.boolean().default(false),
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

  // NEW
  variants: variantUpdateSchema.optional(),
  pruneRemovedVariants: z.boolean().optional(),
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

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !isSiteAdminEmail(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
    const d = parsed.data as z.infer<typeof updateSchema>;

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
      // option groups full replace (as before)
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
              perKg: g.perKg ?? false,
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

      // NEW: variants upsert (non-destructive by default)
      if (d.variants) {
        const existing = await tx.productVariant.findMany({
          where: { productId: id },
        });

        const seen = new Set<string>();
        for (const v of d.variants) {
          const matchById = v.id ? existing.find((e) => e.id === v.id) : null;
          const matchBySize = existing.find((e) => e.sizeGrams === v.sizeGrams);

          if (matchById) {
            seen.add(matchById.id);
            await tx.productVariant.update({
              where: { id: matchById.id },
              data: {
                sizeGrams: v.sizeGrams,
                priceCents: v.priceCents,
                sku: v.sku ?? null,
                inStock: v.inStock ?? true,
                sortOrder: v.sortOrder ?? 0,
              },
            });
          } else if (matchBySize) {
            seen.add(matchBySize.id);
            await tx.productVariant.update({
              where: { id: matchBySize.id },
              data: {
                sizeGrams: v.sizeGrams,
                priceCents: v.priceCents,
                sku: v.sku ?? null,
                inStock: v.inStock ?? true,
                sortOrder: v.sortOrder ?? 0,
              },
            });
          } else {
            const created = await tx.productVariant.create({
              data: {
                productId: id,
                sizeGrams: v.sizeGrams,
                priceCents: v.priceCents,
                sku: v.sku ?? null,
                inStock: v.inStock ?? true,
                sortOrder: v.sortOrder ?? 0,
              },
            });
            seen.add(created.id);
          }
        }

        // optional pruning (danger: can orphan carts with old variant ids)
        if (d.pruneRemovedVariants) {
          const toDelete = existing.filter((e) => !seen.has(e.id));
          if (toDelete.length) {
            await tx.productVariant.deleteMany({
              where: { id: { in: toDelete.map((t) => t.id) } },
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
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !isSiteAdminEmail(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
