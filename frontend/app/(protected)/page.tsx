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
                Agenda operacional
              </h2>
            </div>
            <p className="mt-3 text-sm text-tp-text-muted">
              A agenda de atendimentos não está disponível nesta versão. O planejamento é acompanhado pela equipe responsável pelos serviços.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  return <DashboardQuotesView />;
}