// src/lib/cart-client.ts
"use client";

import type { Cart } from "@/lib/product/cart-types";

export type CartTotals = { subtotalCents: number; totalCents: number };
export type ApiCartResponse = { cart: Cart; totals: CartTotals };

function bump() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("cart:bump"));
  }
}

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  const data = (await res.json().catch(() => ({}))) as any;

  if (!res.ok) {
    const msg = data?.error || res.statusText || "Request failed";
    throw new Error(msg);
  }
  return data as T;
}

// ---- Public API ----
export const cartClient = {
  async get(): Promise<ApiCartResponse> {
    const r = await fetchJSON<ApiCartResponse>("/api/cart");
    // consumer can read r.cart / r.totals
    return r;
  },

  async addLine(args: {
    productId: string;
    variantId: string;
    optionIds?: string[];
    qty?: number;
  }): Promise<ApiCartResponse> {
    const r = await fetchJSON<ApiCartResponse>("/api/cart", {
      method: "POST",
      body: JSON.stringify({
        productId: args.productId,
        variantId: args.variantId,
        optionIds: args.optionIds ?? [],
        qty: Math.max(1, Number(args.qty ?? 1) || 1),
      }),
    });
    bump();
    return r;
  },

  async updateQty(lineId: string, qty: number): Promise<ApiCartResponse> {
    const r = await fetchJSON<ApiCartResponse>(`/api/cart/${lineId}`, {
      method: "PATCH",
      body: JSON.stringify({ qty: Math.max(1, Number(qty) || 1) }),
    });
    bump();
    return r;
  },

  async removeLine(lineId: string): Promise<ApiCartResponse> {
    const r = await fetchJSON<ApiCartResponse>(`/api/cart/${lineId}`, {
      method: "DELETE",
    });
    bump();
    return r;
  },

  async clear(): Promise<ApiCartResponse> {
    const r = await fetchJSON<ApiCartResponse>("/api/cart", {
      method: "DELETE",
    });
    bump();
    return r;
  },
};
