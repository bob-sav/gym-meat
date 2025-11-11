// src/app/admin/gyms/page.tsx
import { requireSiteAdmin } from "@/lib/guards";
import GymsTable from "./ui/GymsTable";
import GymForm from "./ui/GymForm";

export const dynamic = "force-dynamic";

export default async function GymsAdminPage() {
  await requireSiteAdmin(); // ⬅️ gate
  return (
    <main style={{ maxWidth: 1000, margin: "2rem auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Gyms</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <section>
          <h2 style={{ fontWeight: 600, marginBottom: 8 }}>Create Gym</h2>
          <GymForm />
        </section>
        <section>
          <h2 style={{ fontWeight: 600, marginBottom: 8 }}>Existing Gyms</h2>
          <GymsTable />
        </section>
      </div>
    </main>
  );
}
