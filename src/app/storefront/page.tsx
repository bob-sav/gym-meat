// src/app/storefront/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatHuf } from "@/lib/format";
import s from "./storefront.module.css";
import Image from "next/image";

// ---- CONFIG ----
type SpeciesKey = "BEEF" | "CHICKEN" | "TURKEY" | "DUCK" | "GOOSE" | "SALMON";
type PartKey =
  | "SIRLOIN"
  | "TENDERLOIN"
  | "SHORT_LOIN"
  | "RUMP"
  | "RIBEYE"
  | "BREAST"
  | "THIGH"
  | "WHOLE_BIRD"
  | "FILLET";

const SPECIES: { key: SpeciesKey; label: string; icon?: string }[] = [
  { key: "BEEF", label: "Beef" },
  { key: "CHICKEN", label: "Chicken" },
  { key: "TURKEY", label: "Turkey" },
  { key: "DUCK", label: "Duck" },
  { key: "GOOSE", label: "Goose" },
  { key: "SALMON", label: "Salmon" }, // demo
];

const PARTS_BY_SPECIES: Record<
  SpeciesKey,
  { key: PartKey; label: string; icon?: string }[]
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
    { key: "WHOLE_BIRD", label: "Whole" },
  ],
  TURKEY: [
    { key: "BREAST", label: "Breast" },
    { key: "THIGH", label: "Thigh" },
    { key: "WHOLE_BIRD", label: "Whole" },
  ],
  DUCK: [
    { key: "BREAST", label: "Breast" },
    { key: "THIGH", label: "Thigh" },
    { key: "WHOLE_BIRD", label: "Whole" },
  ],
  GOOSE: [
    { key: "BREAST", label: "Breast" },
    { key: "THIGH", label: "Thigh" },
    { key: "WHOLE_BIRD", label: "Whole" },
  ],
  SALMON: [
    { key: "FILLET", label: "Fillet" }, // demo
  ],
};

type Variant = {
  id: string;
  sizeGrams: number;
  priceCents: number;
  inStock: boolean;
  sortOrder?: number;
};

type ProductOption = {
  id: string;
  label: string;
  priceDeltaCents: number;
  isDefault: boolean;
  sortOrder?: number;
};

type ProductOptionGroup = {
  id: string;
  name: string;
  type: "SINGLE" | "MULTIPLE";
  required: boolean;
  minSelect?: number | null;
  maxSelect?: number | null;
  sortOrder?: number;
  options: ProductOption[];
};

type Product = {
  id: string;
  name: string;
  species: SpeciesKey;
  part: PartKey | null;
  imageUrl?: string | null;
  active?: boolean;
  variants: Variant[];
  optionGroups?: ProductOptionGroup[];
};

// ---- HOOKS ----
function useHorizontalSpy<T extends HTMLElement>(
  onActiveIndex: (i: number) => void
) {
  const containerRef = useRef<T | null>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const items = Array.from(el.querySelectorAll("[data-spy='1']"));
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const idx = Number(
            (visible[0].target as HTMLElement).dataset.index || 0
          );
          onActiveIndex(idx);
        }
      },
      { root: el, threshold: [0.5, 0.75, 1] }
    );
    items.forEach((n) => obs.observe(n));
    return () => obs.disconnect();
  }, [onActiveIndex]);
  return containerRef;
}

// ---- PAGE ----
export default function StorefrontPage() {
  const [species, setSpecies] = useState<SpeciesKey>("SALMON"); // demo entry

  const parts = PARTS_BY_SPECIES[species];
  const [part, setPart] = useState<PartKey | null>(parts[0]?.key ?? null);

  // grams options
  const VARIANTS = [250, 500, 750, 1000];
  const [grams, setGrams] = useState<number>(VARIANTS[1]); // 500g default
  // what the user picked for SINGLE groups: groupId -> optionId
  const [singleSelections, setSingleSelections] = useState<
    Record<string, string>
  >({});
  const [qty, setQty] = useState<number>(1);

  // fetch products (either filter on server or client). Here: client fetch all, filter in-memory.
  const [all, setAll] = useState<Product[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/products", { cache: "no-store" });
        const j = await r.json();
        // keep only active products (optional)
        setAll((j.items ?? []).filter((p: any) => p.active !== false));
      } catch {
        setAll([]);
      }
    })();
  }, []);

  const product = useMemo(() => {
    return (
      all.find(
        (p) => p.species === species && (part ? p.part === part : true)
      ) ?? null
    );
  }, [all, species, part]);

  // whenever product changes, ensure grams matches an available variant
  useEffect(() => {
    if (!product) return;
    const sizes = product.variants.map((v) => v.sizeGrams);
    if (!sizes.includes(grams)) {
      // choose the first available size
      setGrams(sizes[0]);
    }
  }, [product]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derive groups by type
  const singleGroups = useMemo(
    () => (product?.optionGroups ?? []).filter((g) => g.type === "SINGLE"),
    [product]
  );
  const multipleGroups = useMemo(
    () => (product?.optionGroups ?? []).filter((g) => g.type === "MULTIPLE"),
    [product]
  );

  const selectedVariant = useMemo(() => {
    if (!product) return null;
    return (
      product.variants.find((v) => v.sizeGrams === grams) ??
      product.variants[0] ??
      null
    );
  }, [product, grams]);

  const unitPriceCents = selectedVariant?.priceCents ?? 0;
  const totalPriceCents = unitPriceCents * qty;

  const optionIds = useMemo(() => {
    const singles = Object.values(singleSelections).filter(Boolean);
    const multiDefaults = multipleGroups.flatMap((g) =>
      g.options.filter((o) => o.isDefault).map((o) => o.id)
    );
    return [...singles, ...multiDefaults];
  }, [singleSelections, multipleGroups]);

  // When product changes, set defaults for SINGLE (pick default or first)
  useEffect(() => {
    if (!product) {
      setSingleSelections({});
      return;
    }
    const next: Record<string, string> = {};
    for (const g of singleGroups) {
      const def = g.options.find((o) => o.isDefault) ?? g.options[0];
      if (def) next[g.id] = def.id;
    }
    setSingleSelections(next);
  }, [product, singleGroups]);

  const onAdd = useCallback(async () => {
    if (!product || !selectedVariant) return;

    try {
      const r = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          variantId: selectedVariant.id,
          optionIds, // <- from useMemo
          qty,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        alert(j?.error ?? r.statusText);
        return;
      }

      // 🔔 nudge header badge to refresh
      window.dispatchEvent(new Event("cart:bump"));

      alert("Added to cart ✔");
    } catch (e: any) {
      alert(e?.message ?? "Failed to add to cart");
    }
  }, [product, selectedVariant, qty, optionIds]);

  return (
    <main className={s.wrapper}>
      <h1 className={s.title}>Storefront</h1>

      {/* TOP: Species carousel */}
      <SpeciesCarousel
        species={species}
        setSpecies={(sp) => {
          setSpecies(sp);
          const nextParts = PARTS_BY_SPECIES[sp];
          setPart(nextParts[0]?.key ?? null);
        }}
      />

      {/* MIDDLE: Part selector + Cut chart */}
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
                  {g.options.map((o, idx) => {
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
                          // basic keyboard nav: Left/Right moves within the group
                          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                            e.preventDefault();
                            const opts = g.options;
                            const curr = opts.findIndex(
                              (x) => x.id === (singleSelections[g.id] ?? "")
                            );
                            const dir = e.key === "ArrowRight" ? 1 : -1;
                            const next =
                              (curr + dir + opts.length) % opts.length;
                            setSingleSelections((prev) => ({
                              ...prev,
                              [g.id]: opts[next].id,
                            }));
                          }
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
          <SalmonChart
            active={species === "SALMON"}
            selectedPart={part}
            onSelectPart={(p) => setPart(p)}
          />
          {/* Later: beef, chicken, etc. charts composed similarly */}
        </div>
      </div>

      {/* BOTTOM: Variants + price + add */}
      <div className={s.bottom}>
        <VariantStepper
          grams={grams}
          setGrams={setGrams}
          options={VARIANTS}
          availableSizes={
            product ? product.variants.map((v) => v.sizeGrams) : []
          }
        />

        <div className={s.price}>
          <div className={s.priceLabel}>Total</div>
          <div className={s.priceValue}>{formatHuf(totalPriceCents)}</div>
          {selectedVariant && (
            <div className={s.priceMeta}>
              {qty} × {(selectedVariant.sizeGrams / 1000).toFixed(2)} kg @{" "}
              {formatHuf(unitPriceCents)}
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
      </div>
    </main>
  );
}

// ---- Species carousel ----
function SpeciesCarousel({
  species,
  setSpecies,
}: {
  species: SpeciesKey;
  setSpecies: (s: SpeciesKey) => void;
}) {
  const onActiveIndex = (i: number) => {
    // Optional: auto-follow on scroll
    // setSpecies(SPECIES[i]?.key ?? species);
  };
  const ref = useHorizontalSpy<HTMLDivElement>(onActiveIndex);

  return (
    <div ref={ref} className={s.speciesWrap} aria-label="Species">
      {SPECIES.map((sp, i) => (
        <button
          key={sp.key}
          className={s.speciesItem}
          data-spy="1"
          data-index={i}
          aria-pressed={species === sp.key}
          onClick={() => setSpecies(sp.key)}
        >
          <span className={s.speciesIcon} aria-hidden="true">
            {/* Placeholder icon; swap with /public/icons/species/*.svg */}
            <svg width="56" height="56" viewBox="0 0 96 96" fill="none">
              <path d="M.16,39.21c1.53,2.17,3.34,4.05,4.78,5.43,3.33,3.19,10.57,9.77,17.82,10.54-7.55,1.01-14.1-5.38-18.19-8.81-1.07-.9-2.83-2.21-4.58-4.07.04-1.04.09-2.07.16-3.09ZM9.1,46.36s9.55,9.56,19.7,5.21c-9.85,1.16-19.7-5.21-19.7-5.21ZM31.61,52.02c-5.92,2.8-13.56.61-13.56.61,0,0,7.06,4.94,13.56-.61ZM26.75,50.86c-13.59-2.68-23.76-11.74-23.76-11.74,0,0,9.07,12.31,23.76,11.74ZM45.32,14.9c-.48.05-1.03.17-1.49.76,1.05.1,1.41.79,1.19,1.28-.13.28-.92,1.01-1.66.36.09,1.18,1.49,1.88,2.5,1.85,1.35-.04,2.93-1.09,2.73-2.5-.2-1.37-1.98-1.87-3.27-1.74ZM65.88,49.78c-9.25,3.67-20.49,5.09-29.88,8.46-10.42,3.76-14.82,4.89-25.71,7-.31-.69-.59-1.39-.86-2.11,12.29-2.65,19.54-4.68,27.36-7.52,16.4-5.96,30.03-6.42,36.32-14.43,1.09-1.39,2.19-2.51.07-2.99-12.8-1.89-24.21,1.22-23.3-1.02,2.01-4.97,15.1-16.86,20.11-15.87,2.91.57-7.41,7.04-9.6,14.97.54.01,1.21-.15,1.72-.02,1.8-5.2,10.65-12.12,10.8-15.54.05-1.17-1.74-2.23-6.96-1.08-3.99.88-13.78,3.22-22.14,11.33-2.24,2.17-4.42,5.93-2.53,7.68,1.1,1.02,3.76,1.13,6.34.26-1.49,1.42-4.98,2.52-6.81,1.58-5.21-2.67-.83-8.19.42-9.61,2.06-2.34,5.88-5.17,12.05-8-13.44,3.47-20.71,14.04-28.57,15.32-6.39,1.04-11.98-7.43-7.06-17.14-2.18,2.24-4.8,7.38-2.28,14.68,2.49,7.19,10,13.65,19.42,15.66-5.82.66-17.22-4.4-21.1-13.09-2.44-5.48-4.98,1.34-10.27-1.78-1.2-.7-2.12-1.38-2.85-2.04C1.94,22.35,5.66,8.29,15.24,0c1.31.13,2.6.27,3.86.44,10.69,1.42,23.2,4.13,34,8.25,3.94,1.5,17.92,7.49,19.13,8.02,5.28,2.27,2.36,4.91.43,7.88-1.93,2.98-5.91,5.86-7.7,8.92-.32.55-1.36,1.78-1.53,2.71,1.64-.08,4.95.2,6.08.11,2.4-.17,7.23.31,8,1.76,1.99,3.75-4.43,8.81-11.64,11.68ZM51.97,16.98c-1.05.38-2.63,1.05-2.59.67.06-.58.06-1.25-.12-1.89-.36-1.29-2.15-2.36-3.82-2.02-2.5.51-4.2,2.93-2.63,5.38.95.46,1.73.67,2.55.69,1.24.01,2.08-.25,2.94-.55.84-.29,2.6-.93,3.68-2.28Z" />
            </svg>
          </span>
          <span className={s.speciesLabel}>{sp.label}</span>
        </button>
      ))}
    </div>
  );
}

// ---- Parts menu ----
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
                if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                  e.preventDefault();
                  const dir = e.key === "ArrowRight" ? 1 : -1;
                  const next = (idx + dir + parts.length) % parts.length;
                  setPart(parts[next].key);
                }
                if (e.key === "Home") {
                  e.preventDefault();
                  setPart(parts[0].key);
                }
                if (e.key === "End") {
                  e.preventDefault();
                  setPart(parts[parts.length - 1].key);
                }
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

// ---- Salmon cut-chart (demo) ----
// Clickable groups; when clicked, select part "FILLET".
function SalmonChart({
  active,
  selectedPart,
  onSelectPart,
}: {
  active: boolean;
  selectedPart: PartKey | null;
  onSelectPart: (p: PartKey) => void;
}) {
  if (!active)
    return (
      <div style={{ opacity: 0.35 }}>Select a species to view cut chart.</div>
    );

  const isSelected = selectedPart === "FILLET";
  const base = isSelected ? "#dc2626" : "#374151";
  const stroke = isSelected ? "#ffffff" : "#9ca3af";

  return (
    <svg
      viewBox="0 0 480 180"
      width="100%"
      height="220"
      role="img"
      aria-label="Salmon fillet diagram"
    >
      {/* simple fish silhouette */}
      <g id="whole-fish" fill="#1f2937">
        <path d="M20 90 C80 40, 180 40, 260 60 C320 70, 360 80, 440 90 C360 100, 320 110, 260 120 C180 140, 80 140, 20 90 Z" />
        {/* tail */}
        <path d="M440 90 L470 70 L470 110 Z" />
      </g>

      {/* fillet region overlay (clickable group) */}
      <g
        id="FILLET"
        onClick={() => onSelectPart("FILLET")}
        style={{ cursor: "pointer" }}
      >
        <path
          d="M60 88 C120 70, 200 70, 250 82 C300 90, 340 92, 400 92 C340 96, 300 98, 250 106 C200 118, 120 118, 60 92 Z"
          fill={base}
          stroke={stroke}
          strokeWidth={isSelected ? 3 : 2}
        />
        {/* rib lines / texture */}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <line
            key={i}
            x1={90 + i * 40}
            y1={86 + i * 1}
            x2={90 + i * 40}
            y2={106 - i * 1}
            stroke={stroke}
            strokeOpacity="0.5"
            strokeWidth={1}
          />
        ))}
      </g>

      {/* label */}
      <text x="20" y="24" fill="#fff" fontSize="14" fontWeight="600">
        Click the highlighted area to select Fillet
      </text>
    </svg>
  );
}

// ---- Variant stepper ----
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
