import { requireSiteAdmin } from "@/lib/guards";
import ProductForm from "./ProductForm";
import ProductsTable from "./ProductsTable";

export const dynamic = "force-dynamic"; // ensure fresh render in admin

export default async function AdminProductsPage() {
  await requireSiteAdmin(); // ⬅️ one-liner gate

  return (
    <main style={{ maxWidth: 960, margin: "2rem auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Admin · Products</h1>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Create product</h2>
        <ProductForm />
      </section>

      <section>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Products</h2>
        <ProductsTable />
      </section>
    </main>
  );
}
