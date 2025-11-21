// src/app/storefront/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatHuf } from "@/lib/format";
import { SpeciesIcon } from "@/app/_icons/SpeciesIcon";
import SpeciesCutChart from "@/app/_charts/SpeciesCutChart";
import { SpeciesKey, PartKey } from "@/lib/catalog-types";
import GuideDrawer from "../_components/GuideDrawer";
import NutritionCard from "@/app/_components/NutritionCard";
import { resolveNutrition, scaleNutrition } from "@/lib/nutrition";
import { cartClient } from "@/lib/client/cart-client";
import s from "./storefront.module.css";

import {
  SPECIES,
  PARTS_BY_SPECIES,
  ORIGIN_GROUP_NAME,
} from "@/lib/product/constants";
import { findGuide } from "@/lib/product/guides";
import { computeLineTotalsCents } from "@/lib/product/pricing";
import type { NormalizedProduct } from "@/lib/product/types";
import { fetchProductsNormalized } from "@/lib/product/fetch";

// ---- PAGE ----
export default function StorefrontPage() {
  const [species, setSpecies] = useState<SpeciesKey>("BEEF");
  const parts = PARTS_BY_SPECIES[species];
  const [part, setPart] = useState<PartKey | null>(parts[0]?.key ?? null);

  const [grams, setGrams] = useState<number>(500);
  const [qty, setQty] = useState<number>(1);

  const [singleSelections, setSingleSelections] = useState<
    Record<string, string>
  >({});
  const [guideOpen, setGuideOpen] = useState(false);

  const guide = useMemo(() => findGuide(species, part), [species, part]);
  const hasGuide = !!guide;
  const partLabel = part
    ? (PARTS_BY_SPECIES[species].find((p) => p.key === part)?.label ?? "")
    : "";

  // Fetch products
  const [all, setAll] = useState<NormalizedProduct[]>([]);
  useEffect(() => {
    (async () => setAll(await fetchProductsNormalized()))();
  }, []);

  const product = useMemo(
    () =>
      all.find(
        (p) => p.species === species && (part ? p.part === part : true)
      ) ?? null,
    [all, species, part]
  );

  // groups
  const singleGroups = useMemo(
    () => product?.optionGroups.filter((g) => g.type === "SINGLE") ?? [],
    [product]
  );

  // ensure grams matches an available variant
  useEffect(() => {
    if (!product) return;
    const sizes = product.allowedSizes;
    if (!sizes.includes(grams)) setGrams(sizes[0]);
  }, [product]); // eslint-disable-line

  // default SINGLE selections from normalized product
  useEffect(() => {
    if (!product) {
      setSingleSelections({});
      return;
    }
    setSingleSelections(product.defaultSingleSelections);
  }, [product]);

  // build optionIds (selected SINGLE + default MULTIPLE)
  const optionIds = useMemo(() => {
    if (!product) return [];
    const single = Object.values(singleSelections).filter(Boolean);
    const multiDefaults = product.optionGroups
      .filter((g) => g.type === "MULTIPLE")
      .flatMap((g) => g.options.filter((o) => o.isDefault).map((o) => o.id));
    return [...single, ...multiDefaults];
  }, [product, singleSelections]);

  // price
  const { unitCents, totalCents } = useMemo(
    () =>
      product
        ? computeLineTotalsCents(product, grams, optionIds, qty)
        : { unitCents: 0, totalCents: 0 },
    [product, grams, optionIds, qty]
  );

  // origin -> nutrition
  const originGroup = product?.optionGroups.find(
    (g) =>
      g.type === "SINGLE" &&
      g.name.toLowerCase() === ORIGIN_GROUP_NAME.toLowerCase()
  );
  const selectedOriginLabel = originGroup
    ? originGroup.options.find((o) => o.id === singleSelections[originGroup.id])
        ?.label
    : undefined;

  const per100 = resolveNutrition(species, part, selectedOriginLabel);
  const totalGrams = grams * qty;
  const totals = per100 ? scaleNutrition(per100, totalGrams) : null;

  const onAdd = useCallback(async () => {
    if (!product) return;
    const variant = product.variants.find((v) => v.sizeGrams === grams);
    if (!variant) return;

    try {
      await cartClient.addLine({
        productId: product.id,
        variantId: variant.id,
        optionIds,
        qty,
      });
      alert("Added to cart ✔");
    } catch (e: any) {
      alert(e?.message ?? "Failed to add to cart");
    }
  }, [product, grams, optionIds, qty]);

  return (
    <main className={s.wrapper}>
      <h1 className={s.title}>Storefront</h1>

      <SpeciesCarousel
        species={species}
        setSpecies={(sp) => {
          setSpecies(sp);
          const nextParts = PARTS_BY_SPECIES[sp];
          setPart(nextParts[0]?.key ?? null);
        }}
      />

      <div className={s.mid}>
        <PartsMenu species={species} part={part} setPart={setPart} />

        {singleGroups.length > 0 && (
          <div className={s.optionsWrap}>
            {singleGroups.map((g) => (
              <div key={g.id} className={s.optionGroup}>
                <div className={s.groupTitle}>{g.name}</div>
                <div
                  className={s.optionsRow}
                  role="radiogroup"
                  aria-label={g.name}
                >
                  {g.options.map((o) => {
                    const active = singleSelections[g.id] === o.id;
                    return (
                      <button
                        key={o.id}
                        className={s.optionChip}
                        role="radio"
                        aria-checked={active}
                        tabIndex={active ? 0 : -1}
                        onClick={() =>
                          setSingleSelections((prev) => ({
                            ...prev,
                            [g.id]: o.id,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight")
                            return;
                          e.preventDefault();
                          const opts = g.options;
                          const curr = opts.findIndex(
                            (x) => x.id === (singleSelections[g.id] ?? "")
                          );
                          const dir = e.key === "ArrowRight" ? 1 : -1;
                          const next = (curr + dir + opts.length) % opts.length;
                          setSingleSelections((prev) => ({
                            ...prev,
                            [g.id]: opts[next].id,
                          }));
                        }}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className={s.cutchart}>
          <SpeciesCutChart
            species={species}
            selectedPart={part}
            onSelectPart={(p) => setPart(p)}
            availableParts={PARTS_BY_SPECIES[species].map((p) => p.key)}
            ariaLabel={`${species.toLowerCase()} cuts`}
          />
        </div>
      </div>

      <div className={s.bottom}>
        <VariantStepper
          grams={grams}
          setGrams={setGrams}
          options={product?.allowedSizes ?? []}
          availableSizes={product?.allowedSizes ?? []}
        />

        <div className={s.price}>
          <div className={s.priceLabel}>Total</div>
          <div className={s.priceValue}>{formatHuf(totalCents)}</div>
          {product && (
            <div className={s.priceMeta}>
              {qty} × {(grams / 1000).toFixed(2)} kg @ {formatHuf(unitCents)}
            </div>
          )}
        </div>

        <div className={s.qty}>
          <button
            className={s.chip}
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label="Decrease quantity"
          >
            −
          </button>
          <div className={s.qtyNum} aria-live="polite">
            {qty}
          </div>
          <button
            className={s.chip}
            onClick={() => setQty((q) => q + 1)}
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>

        <button className={s.btnPrimary} onClick={onAdd} disabled={!product}>
          {product ? `Add ${product.name} to cart` : "Unavailable"}
        </button>

        <NutritionCard
          per100={per100 ?? undefined}
          total={totals ?? undefined}
        />
      </div>

      <GuideToggle
        open={guideOpen}
        hasGuide={hasGuide}
        label={`${species}${partLabel ? ` · ${partLabel}` : ""}`}
        onToggle={() => setGuideOpen((v) => !v)}
      />

      <GuideDrawer
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        guide={guide}
      />
    </main>
  );
}

/* ---- Small inline UI bits (can be split later) ---- */

function SpeciesCarousel({
  species,
  setSpecies,
}: {
  species: SpeciesKey;
  setSpecies: (s: SpeciesKey) => void;
}) {
  return (
    <div className={s.speciesWrap} role="tablist" aria-label="Species">
      {SPECIES.map((sp) => {
        const selected = species === sp.key;
        return (
          <button
            key={sp.key}
            role="tab"
            aria-selected={selected}
            className={s.speciesItem}
            onClick={() => setSpecies(sp.key)}
          >
            <span className={s.speciesIcon} aria-hidden="true">
              <SpeciesIcon species={sp.key} />
            </span>
            <span className={s.speciesLabel}>{sp.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function PartsMenu({
  species,
  part,
  setPart,
}: {
  species: SpeciesKey;
  part: PartKey | null;
  setPart: (p: PartKey) => void;
}) {
  const parts = PARTS_BY_SPECIES[species];
  return (
    <div className={s.partsWrap}>
      <div className={s.partsTitle}>Select part</div>
      <div className={s.partsRow} role="tablist" aria-label="Parts">
        {parts.map((p) => {
          const selected = part === p.key;
          return (
            <button
              key={p.key}
              className={s.partChip}
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => setPart(p.key)}
              onKeyDown={(e) => {
                const idx = parts.findIndex((x) => x.key === part);
                if (
                  e.key !== "ArrowRight" &&
                  e.key !== "ArrowLeft" &&
                  e.key !== "Home" &&
                  e.key !== "End"
                )
                  return;
                e.preventDefault();
                if (e.key === "Home") return setPart(parts[0].key);
                if (e.key === "End")
                  return setPart(parts[parts.length - 1].key);
                const dir = e.key === "ArrowRight" ? 1 : -1;
                const next = (idx + dir + parts.length) % parts.length;
                setPart(parts[next].key);
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function VariantStepper({
  grams,
  setGrams,
  options,
  availableSizes,
}: {
  grams: number;
  setGrams: (g: number) => void;
  options: number[];
  availableSizes: number[];
}) {
  return (
    <div className={s.stepper} role="radiogroup" aria-label="Weight">
      {options.map((g) => {
        const active = grams === g;
        const available = availableSizes.includes(g);
        return (
          <button
            key={g}
            role="radio"
            aria-checked={active}
            aria-disabled={!available}
            tabIndex={active ? 0 : -1}
            disabled={!available}
            className={s.chip}
            onClick={() => available && setGrams(g)}
            title={`${(g / 1000).toFixed(2)} kg${available ? "" : " (unavailable)"}`}
          >
            {g === 1000 ? "1.00 kg" : `${(g / 1000).toFixed(2)} kg`}
          </button>
        );
      })}
    </div>
  );
}

function GuideToggle({
  open,
  hasGuide,
  onToggle,
  label,
}: {
  open: boolean;
  hasGuide: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      className={`${s.guideToggle} ${open ? s.open : ""}`}
      onClick={onToggle}
      disabled={!hasGuide}
      aria-expanded={open}
      aria-controls="cut-guide-drawer"
      aria-label={
        hasGuide
          ? open
            ? `Close cooking ideas`
            : `Open cooking ideas for ${label}`
          : `No guide available`
      }
      title={hasGuide ? "Cooking ideas" : "No guide available"}
    >
      <span aria-hidden="true" className={s.guideIcon}>
        {open ? (
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path
              d="M9 18h6v2a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-2Zm3-17a7 7 0 0 1 4 12.9V16a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-2.1A7 7 0 0 1 12 1Z"
              fill="currentColor"
            />
          </svg>
        )}
      </span>
      <span className={s.guideLabel}>Guide</span>
    </button>
  );
}
