import { GarantiasPageClient } from "@/components/garantias/GarantiasPageClient";
import { requireRoleSession } from "@/lib/auth-server";

export default async function GarantiasPage() {
  await requireRoleSession(["ADMIN", "PLANNING"]);
  return <GarantiasPageClient />;
}
