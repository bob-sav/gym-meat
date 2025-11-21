// src/data/nutritionProfiles.ts
import type { SpeciesKey, PartKey } from "@/lib/catalog-types";

export type Nutrition = {
  kcal: number; // per 100g
  carbs: number; // g/100g
  fat: number; // g/100g
  protein: number; // g/100g
};

type PerOrigin = Partial<Record<string /* Origin label */, Nutrition>> & {
  __ANY__?: Nutrition; // fallback for any origin of this part
};

export type NutritionProfiles = Partial<
  Record<SpeciesKey, Partial<Record<PartKey | "__ANY__", PerOrigin>>>
>;

export const NUTRITION_PROFILES: NutritionProfiles = {
  CHICKEN: {
    BREAST: {
      __ANY__: { kcal: 110, carbs: 0, fat: 2, protein: 23 },
    },
    THIGH: {
      __ANY__: { kcal: 130, carbs: 0, fat: 5, protein: 20 },
    },
  },
  TURKEY: {
    BREAST: {
      __ANY__: { kcal: 110, carbs: 0, fat: 2, protein: 23 },
    },
    THIGH: {
      __ANY__: { kcal: 130, carbs: 0, fat: 4, protein: 20 },
    },
  },
  DUCK: {
    BREAST: {
      __ANY__: { kcal: 140, carbs: 0, fat: 8, protein: 20 },
    },
    THIGH: {
      __ANY__: { kcal: 160, carbs: 0, fat: 8, protein: 20 },
    },
  },
  GOOSE: {
    BREAST: {
      __ANY__: { kcal: 140, carbs: 0, fat: 5, protein: 22 },
    },
    THIGH: {
      __ANY__: { kcal: 160, carbs: 0, fat: 8, protein: 20 },
    },
  },
  SALMON: {
    FILLET: {
      Wild: { kcal: 182, carbs: 0, fat: 8, protein: 25 },
      Farm: { kcal: 208, carbs: 0, fat: 13, protein: 20 },
      __ANY__: { kcal: 180, carbs: 0, fat: 12, protein: 20 },
    },
  },
  BEEF: {
    SIRLOIN: {
      Local: { kcal: 170, carbs: 0, fat: 9, protein: 20 },
      Angus: { kcal: 215, carbs: 0, fat: 14, protein: 20 },
      Wagyu: { kcal: 280, carbs: 0, fat: 24, protein: 17 },
      __ANY__: { kcal: 205, carbs: 0, fat: 13, protein: 20 },
    },
    TENDERLOIN: {
      Local: { kcal: 140, carbs: 0, fat: 5, protein: 20 },
      Angus: { kcal: 215, carbs: 0, fat: 14, protein: 20 },
      Wagyu: { kcal: 280, carbs: 0, fat: 24, protein: 17 },
      __ANY__: { kcal: 205, carbs: 0, fat: 13, protein: 20 },
    },
    SHORT_LOIN: {
      Local: { kcal: 200, carbs: 0, fat: 12, protein: 20 },
      Angus: { kcal: 215, carbs: 0, fat: 14, protein: 20 },
      Wagyu: { kcal: 280, carbs: 0, fat: 24, protein: 17 },
      __ANY__: { kcal: 205, carbs: 0, fat: 13, protein: 20 },
    },
    RUMP: {
      Local: { kcal: 180, carbs: 0, fat: 10, protein: 20 },
      Angus: { kcal: 215, carbs: 0, fat: 14, protein: 20 },
      Wagyu: { kcal: 280, carbs: 0, fat: 24, protein: 17 },
      __ANY__: { kcal: 205, carbs: 0, fat: 13, protein: 20 },
    },
    RIBEYE: {
      Local: { kcal: 250, carbs: 0, fat: 20, protein: 20 },
      Angus: { kcal: 215, carbs: 0, fat: 14, protein: 20 },
      Wagyu: { kcal: 280, carbs: 0, fat: 24, protein: 17 },
      __ANY__: { kcal: 205, carbs: 0, fat: 13, protein: 20 },
    },
  },
};
