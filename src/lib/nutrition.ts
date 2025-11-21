// src/lib/nutrition.ts
import type { SpeciesKey, PartKey } from "@/lib/catalog-types";
import { NUTRITION_PROFILES, type Nutrition } from "@/data/nutritionProfiles";

export function resolveNutrition(
  species: SpeciesKey,
  part: PartKey | null,
  originLabel?: string | null
): Nutrition | null {
  const bySpecies = NUTRITION_PROFILES[species];
  if (!bySpecies) return null;

  // Try most specific: species -> part -> origin
  if (part && bySpecies[part]) {
    const perOrigin = bySpecies[part]!;
    if (originLabel && perOrigin[originLabel]) return perOrigin[originLabel]!;
    if (perOrigin.__ANY__) return perOrigin.__ANY__!;
  }

  // species -> __ANY__ -> origin
  if (bySpecies.__ANY__) {
    const perOrigin = bySpecies.__ANY__!;
    if (originLabel && perOrigin[originLabel]) return perOrigin[originLabel]!;
    if (perOrigin.__ANY__) return perOrigin.__ANY__!;
  }

  return null;
}

export function scaleNutrition(per100g: Nutrition, grams: number) {
  const f = grams / 100;
  return {
    kcal: Math.round(per100g.kcal * f),
    carbs: +(per100g.carbs * f).toFixed(1),
    fat: +(per100g.fat * f).toFixed(1),
    protein: +(per100g.protein * f).toFixed(1),
  };
}
