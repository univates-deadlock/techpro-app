import Link from "next/link";

import { DashboardQuotesView } from "@/components/dashboard/DashboardQuotesView";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireActiveSession } from "@/lib/auth-server";

/**
 * Role-aware operational home.
 *
 * ADMIN and PLANNING see commercial/quote indicators; TECHNICIAN sees only
 * operational service information without requesting restricted quote data.
 */
export default async function DashboardPage() {
  const { user } = await requireActiveSession();

  if (user.role === "TECHNICIAN") {
    return (
      <div>
        <PageHeader title="Visão geral" />

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-tp-text-main">
                Próximos serviços e visitas
              </h2>
              <Link
                href="/visitas"
                className="text-xs font-semibold text-tp-blue-900 hover:underline"
              >
                Ir para minha agenda
              </Link>
            </div>
            <p className="mt-3 text-sm text-tp-text-muted">
              Sua agenda com as visitas atribuídas a você está disponível em
              &quot;Minha agenda&quot;. Os indicadores deste painel serão exibidos
              quando os endpoints de serviços e visitas forem integrados à API.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  return <DashboardQuotesView />;
}