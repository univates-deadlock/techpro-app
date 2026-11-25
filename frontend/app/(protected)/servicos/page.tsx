import { ServicosPageClient } from "@/components/servicos/ServicosPageClient";
import { requireRoleSession } from "@/lib/auth-server";

/**
 * Gestão de serviços (ADMIN/PLANNING) — cadastro, listagem, edição e status.
 * The API route (branch feat/api-services) denies TECHNICIAN sessions, so the
 * SSR check redirects them to "/". Visit planning lives in /visitas.
 */
export default async function ServicosPage() {
  await requireRoleSession(["ADMIN", "PLANNING"]);
  return <ServicosPageClient />;
}
