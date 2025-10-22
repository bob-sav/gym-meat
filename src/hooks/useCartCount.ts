"use client";
import { useEffect, useState } from "react";

export function useCartCount() {
  const [count, setCount] = useState<number>(0);

  async function refresh() {
    try {
      const r = await fetch("/api/cart", {
        credentials: "include",
        cache: "no-store",
      });
      if (!r.ok) return;
      const j = await r.json();
      const totalLines = Array.isArray(j?.cart?.lines)
        ? j.cart.lines.length
        : 0;
      setCount(totalLines);
    } catch {}
  }

  useEffect(() => {
    refresh();
    // listen for custom events so other components can nudge a refresh
    const onBump = () => refresh();
    window.addEventListener("cart:bump", onBump);
    return () => window.removeEventListener("cart:bump", onBump);
  }, []);

  return { count, refresh };
}
