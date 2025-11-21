// src/lib/product/guides.ts
import type { SpeciesKey, PartKey } from "@/lib/catalog-types";
import { CUT_GUIDES, type CutGuide } from "@/data/cutGuides";

export function findGuide(
  species: SpeciesKey,
  part: PartKey | null
): CutGuide | null {
  const bySpecies = CUT_GUIDES[species];
  if (!bySpecies) return null;
  if (part) {
    const hit = (bySpecies as Partial<Record<PartKey, CutGuide>>)[part];
    if (hit) return hit;
  }
  return bySpecies.__ANY__ ?? null;
}
