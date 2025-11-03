"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

  useEffect(() => {
    let mounted = true;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => mounted && setMe(data))
      .catch(() => mounted && setMe(null));
    return () => {
      mounted = false;
    };
  }, []);

  const r = me?.user?.roles;

  return (
    <header
      style={{
        borderBottom: "1px solid #e5e7eb",
        padding: "10px 16px",
        position: "sticky",
        top: 0,
        background: "white",
        zIndex: 10,
      }}
    >
      <nav
        style={{
          display: "flex",
          gap: 14,
          alignItems: "center",
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        {/* Left: brand */}
        <Link href="/" className="hover:underline" style={{ fontWeight: 700 }}>
          gym-meat
        </Link>

        {/* Public links */}
        <Link href="/products" className="hover:underline">
          Products
        </Link>
        <Link href="/orders" className="hover:underline">
          My Orders
        </Link>

        {/* Role-aware links */}
        {r?.isButcher && (
          <Link href="/butcher" className="hover:underline">
            Butcher
          </Link>
        )}
        {r?.isButcherSettler && (
          <Link href="/butcher/settlements" className="hover:underline">
            Butcher · Settlements
          </Link>
        )}
        {r?.isGymAdmin && (
          <Link href="/gym-admin" className="hover:underline">
            Gym Admin
          </Link>
        )}
        {/* If you want the gym setup page only for super admins, you can
           gate it by email or a future isSuperAdmin flag. */}
        {/* <Link href="/admin/gyms" className="hover:underline">Admin: Gyms</Link> */}

        {/* Right: user */}
        <span style={{ marginLeft: "auto", color: "#667085", fontSize: 14 }}>
          {me?.user?.email ?? ""}
        </span>
      </nav>
    </header>
  );
}
