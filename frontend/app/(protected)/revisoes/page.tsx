import { RevisoesPageClient } from "@/components/revisoes/RevisoesPageClient";
import { requireRoleSession } from "@/lib/auth-server";

export default async function RevisoesPage() {
  await requireRoleSession(["ADMIN", "PLANNING"]);
  return <RevisoesPageClient />;
}
