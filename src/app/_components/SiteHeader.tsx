"use client";
import Link from "next/link";
import { useCartCount } from "@/hooks/useCartCount";

export default function SiteHeader() {
  const { count } = useCartCount();

  return (
    <header style={{ borderBottom: "1px solid #eee", padding: "10px 16px" }}>
      <nav style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Link href="/" style={{ fontWeight: 700, textDecoration: "none" }}>
          GYM-Meat
        </Link>
        <Link href="/products">Products</Link>
        <Link href="/orders">My Orders</Link>
        <div style={{ marginLeft: "auto" }}>
          <Link href="/cart" style={{ position: "relative", paddingRight: 10 }}>
            Cart
            <span
              aria-label="cart count"
              style={{
                marginLeft: 6,
                fontSize: 12,
                background: "#222",
                color: "#fff",
                padding: "2px 6px",
                borderRadius: 999,
              }}
            >
              {count}
            </span>
          </Link>
        </div>
      </nav>
    </header>
  );
}
