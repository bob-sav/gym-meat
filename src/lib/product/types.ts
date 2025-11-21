// src/lib/product/types.ts
import type { SpeciesKey, PartKey } from "@/lib/catalog-types";

export type OptionType = "SINGLE" | "MULTIPLE";

export type ProductOptionDTO = {
  id: string;
  label: string;
  priceDeltaCents: number;
  isDefault: boolean;
  sortOrder: number;
};

export type ProductOptionGroupDTO = {
  id: string;
  name: string;
  type: OptionType;
  required: boolean;
  minSelect: number | null;
  maxSelect: number | null;
  sortOrder: number;
  perKg: boolean; // true => options in this group are per-kg markups
  options: ProductOptionDTO[];
};

export type ProductVariantDTO = {
  id: string;
  sizeGrams: number; // always grams (integers)
  priceCents: number; // base price for this size
  inStock: boolean;
  sortOrder: number;
  // optional convenience label – we’ll fill it in normalize()
  sizeLabel?: string;
};

export type ProductDTO = {
  id: string;
  name: string;
  species: SpeciesKey;
  part: PartKey | null;
  imageUrl: string | null;
  active: boolean;
  variants: ProductVariantDTO[];
  optionGroups: ProductOptionGroupDTO[];
};

export type NormalizedProduct = ProductDTO & {
  byOptionId: Record<string, { groupId: string; option: ProductOptionDTO }>;
  defaultSingleSelections: Record<string, string>; // groupId -> optionId
  allowedSizes: number[]; // e.g. [250, 500, 750, 1000]
};
