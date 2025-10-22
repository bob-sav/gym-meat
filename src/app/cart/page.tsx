"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type CartOption = {
  groupId: string;
  optionId: string;
  label: string;
  priceDeltaCents: number;
};
type CartLine = {
  id: string;
  productId: string;
  name: string;
  unitLabel: string;
  basePriceCents: number;
  options: CartOption[];
  qty: number;
};
type Cart = { lines: CartLine[] };

function money(cents: number) {
  return (cents / 100).toFixed(2) + " €";
}
function lineUnitTotal(l: CartLine) {
  const add = l.options.reduce((s, o) => s + o.priceDeltaCents, 0);
  return l.basePriceCents + add;
}

export default function CartPage() {
  const [cart, setCart] = useState<Cart>({ lines: [] });
  const [loading, setLoading] = useState(true);

  async function load() {
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

  useEffect(() => {
    load();
  }, []);

  async function updateQty(lineId: string, qty: number) {
    await fetch(`/api/cart/${lineId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qty }),
    });
    await load();
    window.dispatchEvent(new Event("cart:bump"));
  }

  async function removeLine(lineId: string) {
    await fetch(`/api/cart/${lineId}`, { method: "DELETE" });
    await load();
    window.dispatchEvent(new Event("cart:bump"));
  }

  const subtotal = cart.lines.reduce((s, l) => s + lineUnitTotal(l) * l.qty, 0);

  return (
    <main style={{ maxWidth: 900, margin: "2rem auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Your Cart</h1>

      {loading && <p>Loading…</p>}

      {!loading && !cart.lines.length && (
        <p>
          Cart is empty.{" "}
          <Link href="/products" style={{ textDecoration: "underline" }}>
            Browse products
          </Link>
          .
        </p>
      )}

      {!loading &&
        cart.lines.map((l) => (
          <div
            key={l.id}
            style={{
              border: "1px solid #eee",
              borderRadius: 8,
              padding: 12,
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{l.name}</div>
                <div style={{ fontSize: 12, color: "#666" }}>{l.unitLabel}</div>
              </div>
              <div>
                {money(lineUnitTotal(l))} × {l.qty}
              </div>
            </div>

            {!!l.options.length && (
              <ul style={{ marginTop: 8, color: "#444", fontSize: 14 }}>
                {l.options.map((o) => (
                  <li key={o.optionId}>
                    {o.label}{" "}
                    {o.priceDeltaCents ? `(+${money(o.priceDeltaCents)})` : ""}
                  </li>
                ))}
              </ul>
            )}

            <div
              style={{
                marginTop: 8,
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              <label>
                Qty:{" "}
                <input
                  type="number"
                  min={1}
                  defaultValue={l.qty}
                  onChange={(e) =>
                    updateQty(l.id, Math.max(1, Number(e.target.value || 1)))
                  }
                  className="border p-1 rounded"
                  style={{ width: 64 }}
                />
              </label>
              <button
                onClick={() => removeLine(l.id)}
                className="my_button"
                //style={{ color: "crimson" }}
              >
                Remove
              </button>
            </div>
          </div>
        ))}

      {!!cart.lines.length && (
        <div style={{ marginTop: 16, textAlign: "right", fontSize: 18 }}>
          Subtotal: <b>{money(subtotal)}</b>
        </div>
      )}

      {!!cart.lines.length && (
        <div
          style={{
            marginTop: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <button
            onClick={async () => {
              await fetch("/api/cart", { method: "DELETE" });
              await load();
              window.dispatchEvent(new Event("cart:bump"));
            }}
            className="my_button"
            //style={{ color: "crimson" }}
          >
            Clear cart
          </button>
          <div style={{ marginTop: 16 }}>
            <Link className="my_button" href="/checkout">
              Proceed to checkout
            </Link>
          </div>
          <div style={{ fontSize: 18 }}>
            Subtotal: <b>{money(subtotal)}</b>
          </div>
        </div>
      )}
    </main>
  );
}
