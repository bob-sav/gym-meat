// src/app/_components/NutritionCard.tsx
"use client";
import s from "./NutritionCard.module.css";

type Props = {
  per100?: { kcal: number; carbs: number; fat: number; protein: number } | null;
  total?: { kcal: number; carbs: number; fat: number; protein: number } | null;
};

export default function NutritionCard({ per100, total }: Props) {
  if (!per100) return null;
  return (
    <section className={s.card} aria-label="Nutrition">
      <div className={s.header}>Nutrition</div>
      <div className={s.grid}>
        <div className={s.col}>
          <div className={s.sub}>per 100 g</div>
          <ul className={s.list}>
            <li>
              kcal <b>{per100.kcal}</b>
            </li>
            <li>
              Carbs <b>{per100.carbs} g</b>
            </li>
            <li>
              Fat <b>{per100.fat} g</b>
            </li>
            <li>
              Protein <b>{per100.protein} g</b>
            </li>
          </ul>
        </div>
        {total && (
          <div className={s.col}>
            <div className={s.sub}>for selection</div>
            <ul className={s.list}>
              <li>
                kcal <b>{total.kcal}</b>
              </li>
              <li>
                Carbs <b>{total.carbs} g</b>
              </li>
              <li>
                Fat <b>{total.fat} g</b>
              </li>
              <li>
                Protein <b>{total.protein} g</b>
              </li>
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
