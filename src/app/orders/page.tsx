import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const r = await fetch(`${process.env.AUTH_URL || ""}/api/orders`, {
    cache: "no-store",
    // In app router on the same domain, a relative fetch also works:
    // but keep absolute if you prefer; cookies are forwarded server-side.
  }).catch(() => null);

  const j = r && r.ok ? await r.json() : { items: [] as any[] };
  const items = (j.items ?? []) as Array<{
    id: string;
    shortCode: string;
    state: string;
    totalCents: number;
    pickupGymName: string | null;
    pickupWhen: string | null;
    createdAt: string;
  }>;

  return (
    <main style={{ maxWidth: 900, margin: "2rem auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>My orders</h1>
      {!items.length && <p>No orders yet.</p>}
      <div style={{ display: "grid", gap: 12 }}>
        {items.map((o) => (
          <div key={o.id} className="border p-3 rounded">
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <b>#{o.shortCode}</b> · {o.state}
              </div>
              <div>
                <b>{(o.totalCents / 100).toFixed(2)} €</b>
              </div>
            </div>
            <div style={{ color: "#666", fontSize: 14, marginTop: 4 }}>
              Pickup: {o.pickupGymName ?? "—"}
              {o.pickupWhen
                ? ` · ${new Date(o.pickupWhen).toLocaleString()}`
                : ""}
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16 }}>
        <Link href="/products" className="my_button">
          Continue shopping
        </Link>
      </div>
    </main>
  );
}
