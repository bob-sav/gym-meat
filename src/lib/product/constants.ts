// src/lib/product/constants.ts
import type { SpeciesKey, PartKey } from "@/lib/catalog-types";

export const SPECIES: { key: SpeciesKey; label: string }[] = [
  { key: "BEEF", label: "Beef" },
  { key: "CHICKEN", label: "Chicken" },
  { key: "TURKEY", label: "Turkey" },
  { key: "DUCK", label: "Duck" },
  { key: "GOOSE", label: "Goose" },
  { key: "SALMON", label: "Salmon" },
];

export const PARTS_BY_SPECIES: Record<
  SpeciesKey,
  { key: PartKey; label: string }[]
> = {
  BEEF: [
    { key: "SIRLOIN", label: "Sirloin" },
    { key: "TENDERLOIN", label: "Tenderloin" },
    { key: "SHORT_LOIN", label: "Short Loin" },
    { key: "RUMP", label: "Rump" },
    { key: "RIBEYE", label: "Ribeye" },
  ],
  CHICKEN: [
    { key: "BREAST", label: "Breast" },
    { key: "THIGH", label: "Thigh" },
  ],
  TURKEY: [
    { key: "BREAST", label: "Breast" },
    { key: "THIGH", label: "Thigh" },
  ],
  DUCK: [
    { key: "BREAST", label: "Breast" },
    { key: "THIGH", label: "Thigh" },
  ],
  GOOSE: [
    { key: "BREAST", label: "Breast" },
    { key: "THIGH", label: "Thigh" },
  ],
  SALMON: [{ key: "FILLET", label: "Fillet" }],
};

export const ORIGIN_GROUP_NAME = "Origin";
