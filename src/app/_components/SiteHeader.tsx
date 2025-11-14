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
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 18a2 2 0 1 0 0 4a2 2 0 0 0 0-4Zm10 0a2 2 0 1 0 0 4a2 2 0 0 0 0-4ZM6 4h14l-1.6 8H8.2L7.1 6H3V4h3Zm2.7 8h8.8L19 6H8.9L8.7 4H6.2l1.1 8Z"
      />
    </svg>
  );
}
