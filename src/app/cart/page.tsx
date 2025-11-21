"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { formatHuf } from "@/lib/format";
import s from "./cart.module.css";

import type { Cart, CartLine, CartOption } from "@/lib/product/cart-types";
import { lineUnitTotalCents } from "@/lib/product/price";

function money(amountHuf: number) {
  return formatHuf(amountHuf);
}

export default function CartPage() {
  const [cart, setCart] = useState<Cart>({ lines: [] });
  const [loading, setLoading] = useState(true);

  // per-line "in-flight" state (adds gentle fade/scale)
  const [pending, setPending] = useState<Record<string, boolean>>({});

  // debounce timers per line id
  const timers = useRef<Record<string, number>>({});

  // ---- Loaders ----
  async function loadInitial() {
    setLoading(true);
    try {
      const r = await fetch("/api/cart", {
        credentials: "include",
        cache: "no-store",
      });
      const j = await r.json();
      setCart(j?.cart ?? { lines: [] });
    } finally {
      setLoading(false);
    }
  }

  // Soft refresh (no global loading flag)
  async function refreshCartSilently() {
    const r = await fetch("/api/cart", {
      credentials: "include",
      cache: "no-store",
    });
    const j = await r.json().catch(() => ({}));
    if (j?.cart) setCart(j.cart);
  }

  useEffect(() => {
    loadInitial();
    return () => {
      // cleanup any active debounce timers
      Object.values(timers.current).forEach((t) => clearTimeout(t));
    };
  }, []);

  // keep header badge in sync
  useEffect(() => {
    if (!loading) window.dispatchEvent(new Event("cart:bump"));
  }, [loading, cart?.lines?.length]);

  // ---- Optimistic Qty Update (debounced) ----
  function updateQtyDebounced(lineId: string, nextQty: number) {
    // Boundaries
    nextQty = Math.max(1, Number(nextQty) || 1);

    // optimistic: update local state immediately
    setPending((p) => ({ ...p, [lineId]: true }));
    setCart((prev) => ({
      ...prev,
      lines: prev.lines.map((l) =>
        l.id === lineId ? { ...l, qty: nextQty } : l
      ),
    }));
    window.dispatchEvent(new Event("cart:bump"));

    // debounce the network call
    clearTimeout(timers.current[lineId]);
    timers.current[lineId] = window.setTimeout(async () => {
      const old = cart.lines.find((l) => l.id === lineId)?.qty ?? 1;
      try {
        const r = await fetch(`/api/cart/${lineId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qty: nextQty }),
          credentials: "include",
        });
        if (!r.ok) {
          // revert
          setCart((prev) => ({
            ...prev,
            lines: prev.lines.map((l) =>
              l.id === lineId ? { ...l, qty: old } : l
            ),
          }));
          const j = await r.json().catch(() => ({}));
          alert(j?.error ?? r.statusText);
        } else {
          // optional re-sync
          refreshCartSilently();
        }
      } catch (e: any) {
        // revert on error
        setCart((prev) => ({
          ...prev,
          lines: prev.lines.map((l) =>
            l.id === lineId ? { ...l, qty: old } : l
          ),
        }));
        alert(e?.message ?? "Update failed");
      } finally {
        setPending((p) => ({ ...p, [lineId]: false }));
        window.dispatchEvent(new Event("cart:bump"));
      }
    }, 180);
  }

  // ---- Optimistic Remove ----
  async function removeLine(lineId: string) {
    const old = cart;
    // optimistic remove
    setCart((prev) => ({
      ...prev,
      lines: prev.lines.filter((l) => l.id !== lineId),
    }));
    window.dispatchEvent(new Event("cart:bump"));

    try {
      const r = await fetch(`/api/cart/${lineId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) {
        setCart(old); // revert
        const j = await r.json().catch(() => ({}));
        alert(j?.error ?? r.statusText);
      } else {
        await refreshCartSilently();
      }
    } catch (e: any) {
      setCart(old); // revert
      alert(e?.message ?? "Remove failed");
    } finally {
      // ensure header badge sync after final state
      window.dispatchEvent(new Event("cart:bump"));
    }
  }

  // ---- Optimistic Clear ----
  async function clearCart() {
    const old = cart;
    // optimistic clear
    setCart({ lines: [] });
    window.dispatchEvent(new Event("cart:bump"));

    try {
      const r = await fetch("/api/cart", {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) {
        setCart(old); // revert
        const j = await r.json().catch(() => ({}));
        alert(j?.error ?? r.statusText);
      }
    } catch (e: any) {
      setCart(old); // revert
      alert(e?.message ?? "Clear failed");
    } finally {
      // ensure header badge sync after final state
      window.dispatchEvent(new Event("cart:bump"));
    }
  }

  const subtotal = useMemo(
    () => cart.lines.reduce((s, l) => s + lineUnitTotalCents(l) * l.qty, 0),
    [cart.lines]
  );
  const totalQty = useMemo(
    () => cart.lines.reduce((s, l) => s + (Number(l.qty ?? 1) || 0), 0),
    [cart.lines]
  );

  const hasItems = cart.lines.length > 0;
  const wrapperClass = `${s.wrapper} ${hasItems ? s.stickyPad : ""}`;

  return (
    <main className={wrapperClass}>
      <h1 className={s.title}>
        Your Cart{" "}
        {totalQty ? (
          <span className={s.titleSmall}>({totalQty} items)</span>
        ) : null}
      </h1>

      {loading && <p className={s.loading}>Loading…</p>}

      {!loading && !hasItems && (
        <p className={s.empty}>
          Cart is empty.{" "}
          <Link href="/storefront" style={{ textDecoration: "underline" }}>
            Browse products
          </Link>
          .
        </p>
      )}

      {hasItems && (
        <div className={s.list}>
          {cart.lines.map((l) => {
            const unit = lineUnitTotalCents(l);
            const lineTotal = unit * l.qty;
            const isUpdating = !!pending[l.id];

            return (
              <article
                key={l.id}
                className={`${s.card} ${isUpdating ? s.updating : ""}`}
              >
                <div className={s.row}>
                  <div>
                    <div className={s.name}>{l.name}</div>
                    <div className={s.unitLabel}>{l.unitLabel}</div>
                  </div>
                  <div
                    className={`${s.priceBlock} ${isUpdating ? s.bump : ""}`}
                  >
                    <div className={s.unitLine}>
                      {money(unit)} × {l.qty}
                    </div>
                    <div className={s.totalLine} aria-label="Line total">
                      = {money(lineTotal)}
                    </div>
                  </div>
                </div>

                {!!l.options.length && (
                  <ul className={s.options}>
                    {l.options.map((o) => (
                      <li key={o.optionId}>
                        {o.label}
                        {o.priceDeltaCents
                          ? o.perKg
                            ? ` (+${money(o.priceDeltaCents)} / kg)`
                            : ` (+${money(o.priceDeltaCents)})`
                          : ""}
                      </li>
                    ))}
                  </ul>
                )}

                <div className={s.controls}>
                  <div className={s.qty}>
                    <button
                      className={s.chip}
                      onClick={() =>
                        updateQtyDebounced(
                          l.id,
                          Math.max(1, (Number(l.qty) || 1) - 1)
                        )
                      }
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <div className={s.qtyNum} aria-live="polite">
                      {l.qty}
                    </div>
                    <button
                      className={s.chip}
                      onClick={() =>
                        updateQtyDebounced(l.id, (Number(l.qty) || 1) + 1)
                      }
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>

                  <button
                    onClick={() => removeLine(l.id)}
                    className="my_button"
                  >
                    Remove
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {hasItems && (
        <section className={s.actions} aria-label="Cart actions">
          <button onClick={clearCart} className="my_button">
            Clear cart
          </button>

          <Link className={` my_button ${s.desktopOnly}`} href="/checkout">
            Proceed to checkout
          </Link>

          <div className={s.subtotal}>
            Subtotal: <b>{money(subtotal)}</b>
          </div>
        </section>
      )}

      {/* Mobile sticky summary bar */}
      {hasItems && (
        <div className={s.stickyBar} role="region" aria-label="Cart summary">
          <div className={s.stickySubtotal} aria-live="polite">
            <div>
              <b>{money(subtotal)}</b> total
            </div>
            <span className={s.stickyQty}>{totalQty} items</span>
          </div>
          <Link className={`my_button ${s.stickyCheckout}`} href="/checkout">
            Checkout
          </Link>
        </div>
      )}
    </main>
  );
}
