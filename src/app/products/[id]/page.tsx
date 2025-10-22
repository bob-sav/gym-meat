import { PrismaClient } from "@prisma/client";
import ProductConfigurator from "./ui/ProductConfigurator";
import { notFound } from "next/navigation";

const prisma = new PrismaClient();

export default async function ProductDetail({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;

  const p = await prisma.product.findUnique({
    where: { id },
    include: {
      variants: {
        orderBy: [{ sortOrder: "asc" }, { sizeGrams: "asc" }],
      },
      optionGroups: {
        orderBy: { sortOrder: "asc" },
        include: { options: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  if (!p) return notFound();

  const minPrice =
    p.variants.length > 0
      ? Math.min(...p.variants.map((v) => v.priceCents))
      : undefined;

  return (
    <main style={{ maxWidth: 900, margin: "2rem auto", padding: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div>
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.imageUrl}
              alt={p.name}
              style={{ width: "100%", borderRadius: 8 }}
            />
          ) : (
            <div
              style={{ height: 320, background: "#f5f5f5", borderRadius: 8 }}
            />
          )}
        </div>

        <div>
          <h1 style={{ fontSize: 28, marginBottom: 6 }}>{p.name}</h1>
          <div style={{ color: "#666", marginBottom: 8 }}>
            {p.species}
            {p.part ? ` · ${p.part}` : ""}
          </div>

          {minPrice !== undefined && (
            <div style={{ fontSize: 20, marginBottom: 4 }}>
              from {(minPrice / 100).toFixed(2)} €
            </div>
          )}

          {p.description && (
            <p style={{ marginTop: 8, color: "#444" }}>{p.description}</p>
          )}

          <ProductConfigurator product={p as any} />
          {/* ^ ProductConfigurator expects { variants, optionGroups } etc. */}
        </div>
      </div>
    </main>
  );
}
