import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

/** ---- Runtime enums for Zod ---- */
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

/** ---- Validation ---- */
const optionSchema = z.object({
  label: z.string().min(1),
  priceDeltaCents: z.number().int().nonnegative().default(0),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().int().nonnegative().default(0),
});

const groupSchema = z.object({
  name: z.string().min(1),
  type: z.enum(OptionGroupTypeValues),
  required: z.boolean().default(false),
  minSelect: z.number().int().min(0).optional(),
  maxSelect: z.number().int().min(0).optional(),
  sortOrder: z.number().int().nonnegative().default(0),
  options: z.array(optionSchema).default([]),
});

const variantSchema = z.object({
  sizeGrams: z.number().int().positive(), // e.g. 250 | 500 | 750 | 1000
  priceCents: z.number().int().nonnegative(),
  sku: z.string().trim().min(1).optional(),
  inStock: z.boolean().default(true),
  sortOrder: z.number().int().nonnegative().default(0),
});

const createSchema = z.object({
  name: z.string().min(1),
  species: z.enum(SpeciesValues),
  part: z.enum(PartValues).optional(),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  active: z.boolean().default(true),
  variants: z.array(variantSchema).min(1, "At least one variant is required"),
  optionGroups: z.array(groupSchema).default([]),
});

/** ---- GET /api/products ----
 * Returns products + variants + option groups (and their options)
 */
export async function GET() {
  const items = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      variants: {
        orderBy: [{ sortOrder: "asc" }, { sizeGrams: "asc" }],
      },
      optionGroups: {
        orderBy: { sortOrder: "asc" },
        include: { options: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  return NextResponse.json({ items });
}

/** ---- POST /api/products ----
 * Creates a product with variants and (optional) option groups.
 * Body must conform to createSchema above.
 */
export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const d = parsed.data;

    const created = await prisma.product.create({
      data: {
        name: d.name,
        species: d.species as any, // DB enum enforces correctness
        part: (d.part ?? null) as any,
        description: d.description ?? null,
        imageUrl: d.imageUrl ?? null,
        active: d.active,

        variants: {
          create: d.variants.map((v) => ({
            sizeGrams: v.sizeGrams,
            priceCents: v.priceCents,
            sku: v.sku ?? null,
            inStock: v.inStock,
            sortOrder: v.sortOrder,
          })),
        },

        optionGroups: {
          create: d.optionGroups.map((g) => ({
            name: g.name,
            type: g.type as any,
            required: g.required,
            minSelect: g.minSelect ?? null,
            maxSelect: g.maxSelect ?? null,
            sortOrder: g.sortOrder,
            options: {
              create: g.options.map((o) => ({
                label: o.label,
                priceDeltaCents: o.priceDeltaCents,
                isDefault: o.isDefault,
                sortOrder: o.sortOrder,
              })),
            },
          })),
        },
      },
      include: {
        variants: true,
        optionGroups: { include: { options: true } },
      },
    });

    return NextResponse.json({ item: created }, { status: 201 });
  } catch (e) {
    console.error("POST /api/products failed", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
