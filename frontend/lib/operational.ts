/**
 * Operational metrics are aggregated by the API. The browser never infers
 * alert status or reads sensitive commercial records for technician profiles.
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type ClientSummary = { id: string; name: string };
type ServiceSummary = { id: string; title: string; client: ClientSummary };
type Counted<T> = { count: number; items: T[] };

export type OperationalDashboard = {
  window: { days: number; timeZone: string; start: string; endExclusive: string };
  quotes: Record<string, number>;
  services: { upcoming: Counted<ServiceSummary & { status: string; plannedStart: string | null }> };
  visits: { upcoming: Counted<{
    id: string; status: string; scheduledStart: string; service: ServiceSummary;
  }> };
  alerts: {
    revisions: {
      overdue: Counted<{ id: string; scheduledAt: string; service: ServiceSummary }>;
      upcoming: Counted<{ id: string; scheduledAt: string; service: ServiceSummary }>;
    };
    warranties: {
      expired: Counted<{ id: string; endsAt: string; service: ServiceSummary }>;
      expiring: Counted<{ id: string; endsAt: string; service: ServiceSummary }>;
    };
  };
};

export async function getOperationalDashboard(): Promise<OperationalDashboard> {
  let response: Response;
  try {
    response = await fetch(API_BASE + "/api/dashboard", { credentials: "include" });
  } catch {
    throw new Error("Não foi possível conectar ao servidor.");
  }

  if (!response.ok) {
    if (response.status === 401) throw new Error("Sessão expirada. Entre novamente.");
    if (response.status === 403) throw new Error("Acesso negado aos indicadores operacionais.");
    throw new Error("Não foi possível carregar os indicadores operacionais.");
  }
  return (await response.json()) as OperationalDashboard;
}
