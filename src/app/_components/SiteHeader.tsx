"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import s from "./siteheader.module.css";

type Roles = {
  isGymAdmin: boolean;
  gymIds: string[];
  isButcher: boolean;
  isButcherSettler: boolean;
};
type Me = {
  ok: boolean;
  user: { name: string | null; email: string | null; roles: Roles };
};

export default function SiteHeader() {
  const [me, setMe] = useState<Me | null>(null);
  const [cartCount, setCartCount] = useState<number>(0);
  const [menuOpen, setMenuOpen] = useState(false);

  // ------- helpers -------
  const fetchMe = useCallback(async () => {
    try {
      const r = await fetch("/api/me", { cache: "no-store" });
      const j = await r.json();
      setMe(j);
    } catch {
      setMe(null);
    }
  }, []);

  // replace fetchCartCount with this version
  const fetchCartCount = useCallback(async () => {
    try {
      const r = await fetch("/api/cart", {
        cache: "no-store",
        credentials: "include",
      });
      const j = await r.json().catch(() => ({}));

      // normalize possible shapes
      const lines = j?.cart?.lines ?? j?.lines ?? j?.items ?? [];

      const count = Array.isArray(lines)
        ? lines.reduce((sum, l) => sum + (Number(l?.qty ?? 1) || 0), 0)
        : 0;

      setCartCount(count);
    } catch {
      setCartCount(0);
    }
  }, []);

  // ------- effects -------
  useEffect(() => {
    let mounted = true;
    (async () => {
      await Promise.all([fetchMe(), fetchCartCount()]);
    })();
    const onBump = () => fetchCartCount();
    const onVis = () => {
      if (document.visibilityState === "visible") fetchCartCount();
    };
    window.addEventListener("cart:bump", onBump);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      if (!mounted) return;
      window.removeEventListener("cart:bump", onBump);
      document.removeEventListener("visibilitychange", onVis);
      mounted = false;
    };
  }, [fetchMe, fetchCartCount]);

  const r = me?.user?.roles;
  const email = me?.user?.email ?? "";

  return (
    <header className={s.header}>
      <nav className={s.nav}>
        {/* Left: brand */}
        <Link href="/" className={s.brand} aria-label="Gym Meat home">
          <MeatLogo />
          <span className={s.brandText}>Meat&nbsp;Point</span>
        </Link>

        {/* Middle: primary links (collapsible on mobile) */}
        <button
          className={s.burger}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          aria-controls="site-primary"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <BurgerIcon />
        </button>

        <div
          id="site-primary"
          className={s.primary + (menuOpen ? " " + s.open : "")}
          onClick={() => setMenuOpen(false)}
        >
          <Link href="/storefront" className={s.link}>
            Storefront
          </Link>
          <Link href="/products" className={s.link}>
            Products
          </Link>
          <Link href="/orders" className={s.link}>
            My Orders
          </Link>

          {/* Role-aware links */}
          {r?.isButcher && (
            <Link href="/butcher" className={s.link}>
              Butcher
            </Link>
          )}
          {r?.isButcherSettler && (
            <Link href="/butcher/settlements" className={s.link}>
              Settlements
            </Link>
          )}
          {r?.isGymAdmin && (
            <Link href="/gym-admin" className={s.link}>
              Gym Admin
            </Link>
          )}
        </div>

        {/* Right: actions */}
        <div className={s.actions}>
          <Link href="/cart" className={s.iconBtn} aria-label="Cart">
            <CartIcon />
            {cartCount > 0 && (
              <span className={s.badge} aria-label={`${cartCount} in cart`}>
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            )}
          </Link>
          <Link href="/account" className={s.iconBtn} aria-label="Account">
            <UserIcon />
          </Link>
          <span className={s.user} title={email}>
            {email}
          </span>
        </div>
      </nav>
    </header>
  );
}

/* ---------------- Icons (inline, currentColor) ---------------- */

function MeatLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12.6 2.1c-3.5.3-6.4 3.2-6.7 6.7c-.2 2.6 1.1 5.4 3.4 7.7c2.3 2.3 5.1 3.6 7.7 3.4c3.5-.3 6.4-3.2 6.7-6.7c.2-2.6-1.1-5.4-3.4-7.7c-2.3-2.3-5.1-3.6-7.7-3.4Zm1.1 5.4a2.6 2.6 0 1 1 0 5.2a2.6 2.6 0 0 1 0-5.2Z"
      />
    </svg>
  );
}

function BurgerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3 6h18v2H3V6Zm0 5h18v2H3v-2Zm0 5h18v2H3v-2Z"
      />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 640 640" aria-hidden="true">
      <path
        fill="currentColor"
        d="M24 48C10.7 48 0 58.7 0 72C0 85.3 10.7 96 24 96L69.3 96C73.2 96 76.5 98.8 77.2 102.6L129.3 388.9C135.5 423.1 165.3 448 200.1 448L456 448C469.3 448 480 437.3 480 424C480 410.7 469.3 400 456 400L200.1 400C188.5 400 178.6 391.7 176.5 380.3L171.4 352L475 352C505.8 352 532.2 330.1 537.9 299.8L568.9 133.9C572.6 114.2 557.5 96 537.4 96L124.7 96L124.3 94C119.5 67.4 96.3 48 69.2 48L24 48zM208 576C234.5 576 256 554.5 256 528C256 501.5 234.5 480 208 480C181.5 480 160 501.5 160 528C160 554.5 181.5 576 208 576zM432 576C458.5 576 480 554.5 480 528C480 501.5 458.5 480 432 480C405.5 480 384 501.5 384 528C384 554.5 405.5 576 432 576z"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 640 640" aria-hidden="true">
      <path
        fill="currentColor"
        d="M320 312C386.3 312 440 258.3 440 192C440 125.7 386.3 72 320 72C253.7 72 200 125.7 200 192C200 258.3 253.7 312 320 312zM290.3 368C191.8 368 112 447.8 112 546.3C112 562.7 125.3 576 141.7 576L498.3 576C514.7 576 528 562.7 528 546.3C528 447.8 448.2 368 349.7 368L290.3 368z"
      />
    </svg>
  );
}
