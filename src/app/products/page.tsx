import { PrismaClient } from "@prisma/client";
import Link from "next/link";

export const dynamic = "force-dynamic";
const prisma = new PrismaClient();

export default async function ProductsPage() {
  const items = await prisma.product.findMany({
    where: { active: true },
    orderBy: [{ species: "asc" }, { name: "asc" }],
    include: {
      variants: { orderBy: [{ sortOrder: "asc" }, { sizeGrams: "asc" }] },
    },
  });

  return (
    <main style={{ maxWidth: 1000, margin: "2rem auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Products</h1>
      {!items.length && <p>No products yet.</p>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))",
          gap: 16,
        }}
      >
        {items.map((p) => {
          const minPrice =
            p.variants.length > 0
              ? Math.min(...p.variants.map((v) => v.priceCents))
              : undefined;

          return (
            <Link
              key={p.id}
              href={`/products/${p.id}`}
              style={{
                display: "block",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 12,
                textDecoration: "none",
                color: "inherit",
              }}
            >
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.imageUrl}
                  alt={p.name}
                  style={{
                    width: "100%",
                    height: 140,
                    objectFit: "cover",
                    borderRadius: 6,
                  }}
                />
              ) : (
                <div
                  style={{
                    height: 140,
                    background: "#f5f5f5",
                    borderRadius: 6,
                  }}
                />
              )}

              <div style={{ marginTop: 10, fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: "#666" }}>
                {p.species}
                {p.part ? ` · ${p.part}` : ""}
              </div>

              <div style={{ marginTop: 6 }}>
                {minPrice !== undefined ? (
                  <>from {(minPrice / 100).toFixed(2)} €</>
                ) : (
                  <span style={{ color: "#666" }}>Pricing coming soon</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
