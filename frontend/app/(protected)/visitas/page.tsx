import { VisitasPageClient } from "@/components/visitas/VisitasPageClient";
import { requireActiveSession } from "@/lib/auth-server";

/**
 * Agenda de visitas, role-aware: ADMIN/PLANNING manage scheduling and
 * technician assignment; TECHNICIAN sees and executes only their own visits.
 * The `serviceId` query param preselects a service (link from /servicos).
 */
export default async function VisitasPage({
  searchParams,
}: {
  searchParams: Promise<{ serviceId?: string }>;
}) {
  const { user } = await requireActiveSession();
  const { serviceId } = await searchParams;
  return (
    <VisitasPageClient
      user={{ id: user.id, name: user.name, role: user.role }}
      initialServiceId={serviceId}
    />
  );
}
