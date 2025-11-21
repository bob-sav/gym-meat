// src/app/orders/CartBumpClient.tsx
"use client";

import { useEffect } from "react";
import { cartClient } from "@/lib/client/cart-client";

export default function CartBumpClient() {
  useEffect(() => {
    // Sync client-side cart state with the server-cleared cart,
    // then notify any listeners (header badge, etc.)
    cartClient
      .get()
      .catch(() => {
        // ignore errors, we just want a bump
      })
      .finally(() => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("cart:bump"));
        }
      });
  }, []);

  return null;
}
