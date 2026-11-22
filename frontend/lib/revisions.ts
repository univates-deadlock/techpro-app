/**
 * Revision data layer — thin client for the revisions API.
 *
 * `scheduledAt` is a date-only string "YYYY-MM-DD"; display formatting is
 * handled by the screen via `formatDateOnly` from `lib/money.ts`.
 */

export type RevisionStatus = "PENDING" | "SCHEDULED" | "COMPLETED" | "CANCELLED";

export type Revision = {
  id: string;
  serviceId: string;
  serviceTitle: string;
  clientName: string;
  scheduledAt: string;
  status: RevisionStatus;
  notes: string | null;
};

export type CreateRevisionPayload = {
  serviceId: string;
  scheduledAt: string;
  notes?: string | null;
};

export type UpdateRevisionPayload = Omit<CreateRevisionPayload, "serviceId">;

/** Badge tone metadata for revision status. */
export const REVISION_STATUS_META: Record<
  RevisionStatus,
  { label: string; badgeTone: "success" | "danger" | "info" | "warning" | "neutral" }
> = {
  PENDING: { label: "Pendente", badgeTone: "warning" },
  SCHEDULED: { label: "Agendada", badgeTone: "info" },
  COMPLETED: { label: "Realizada", badgeTone: "success" },
  CANCELLED: { label: "Cancelada", badgeTone: "neutral" },
};

let nextId = 5;

const MOCK_REVISIONS: Revision[] = [
  {
    id: "rev-001",
    serviceId: "svc-001",
    serviceTitle: "Instalação CFTV Loja Centro",
    clientName: "Maria Souza",
    scheduledAt: "2025-06-10",
    status: "PENDING",
    notes: "Verificar gravação e limpeza das lentes",
  },
  {
    id: "rev-002",
    serviceId: "svc-002",
    serviceTitle: "Manutenção Alarme Galpão",
    clientName: "Tech Solutions LTDA",
    scheduledAt: "2026-12-20",
    status: "SCHEDULED",
    notes: null,
  },
  {
    id: "rev-003",
    serviceId: "svc-003",
    serviceTitle: "Cerca Elétrica Residência",
    clientName: "João Silva",
    scheduledAt: "2026-08-15",
    status: "COMPLETED",
    notes: "Revisão preventiva realizada sem ocorrências",
  },
  {
    id: "rev-004",
    serviceId: "svc-001",
    serviceTitle: "Instalação CFTV Loja Centro",
    clientName: "Maria Souza",
    scheduledAt: "2026-04-01",
    status: "CANCELLED",
    notes: "Cliente solicitou cancelamento",
  },
];

/** Lists all revisions. */
export async function listRevisions(): Promise<Revision[]> {
  // MOCK: replace with fetch to GET /api/revisions (integration pending)
  return MOCK_REVISIONS;
}

/** Creates a new revision. */
export async function createRevision(payload: CreateRevisionPayload): Promise<Revision> {
  // MOCK: replace with fetch to POST /api/revisions (integration pending)
  const existing = MOCK_REVISIONS.find((r) => r.serviceId === payload.serviceId);
  const created: Revision = {
    id: `rev-${String(nextId++).padStart(3, "0")}`,
    serviceId: payload.serviceId,
    serviceTitle: existing?.serviceTitle ?? "Serviço",
    clientName: existing?.clientName ?? "Cliente",
    scheduledAt: payload.scheduledAt,
    status: "PENDING",
    notes: payload.notes ?? null,
  };
  MOCK_REVISIONS.push(created);
  return created;
}

/** Updates an existing revision. */
export async function updateRevision(
  id: string,
  payload: UpdateRevisionPayload,
): Promise<Revision> {
  // MOCK: replace with fetch to PATCH /api/revisions/:id (integration pending)
  const index = MOCK_REVISIONS.findIndex((r) => r.id === id);
  if (index === -1) throw new Error("Revisão não encontrada.");
  const updated: Revision = {
    ...MOCK_REVISIONS[index],
    scheduledAt: payload.scheduledAt,
    notes: payload.notes ?? null,
  };
  MOCK_REVISIONS[index] = updated;
  return updated;
}

/** Changes the status of a revision. */
export async function changeRevisionStatus(
  id: string,
  status: RevisionStatus,
): Promise<Revision> {
  // MOCK: replace with fetch to PATCH /api/revisions/:id/status (integration pending)
  const index = MOCK_REVISIONS.findIndex((r) => r.id === id);
  if (index === -1) throw new Error("Revisão não encontrada.");
  const updated: Revision = { ...MOCK_REVISIONS[index], status };
  MOCK_REVISIONS[index] = updated;
  return updated;
}
