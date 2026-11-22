/**
 * Revision data layer — thin client for the revisions API.
 *
 * `scheduledAt` is a date-only string "YYYY-MM-DD" in the UI; converted to
 * ISO 8601 when sent to the API. Display formatting is handled by the screen.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

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

type RawRevision = {
  id: string;
  serviceId: string;
  visitId?: string | null;
  scheduledAt: string;
  status: RevisionStatus;
  notes: string | null;
  service?: {
    id: string;
    title: string;
    client?: { id: string; name: string };
  };
};

function mapRevision(raw: RawRevision): Revision {
  return {
    id: raw.id,
    serviceId: raw.serviceId,
    serviceTitle: raw.service?.title ?? "Serviço",
    clientName: raw.service?.client?.name ?? "Cliente",
    scheduledAt: raw.scheduledAt ? raw.scheduledAt.slice(0, 10) : "",
    status: raw.status,
    notes: raw.notes,
  };
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (Array.isArray(body?.fields) && body.fields.length > 0) {
      return body.fields
        .map((f: { path: string; message: string }) => f.message)
        .join(" ");
    }
    if (typeof body?.error === "string") return body.error;
    if (typeof body?.message === "string") return body.message;
  } catch {}
  if (res.status === 401) return "Sessão expirada. Entre novamente.";
  if (res.status === 403) return "Acesso negado: seu perfil não tem permissão para gerenciar revisões.";
  return `${fallback} (Status HTTP: ${res.status})`;
}

function toIsoScheduledAt(dateOnly: string): string {
  if (dateOnly.includes("T")) return dateOnly;
  return `${dateOnly}T12:00:00.000Z`;
}

/** Lists all revisions from the API. */
export async function listRevisions(): Promise<Revision[]> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/revisions`, {
      credentials: "include",
    });
  } catch {
    throw new Error("Não foi possível falar com o servidor.");
  }

  if (!res.ok) {
    throw new Error(await readError(res, "Não foi possível carregar as revisões."));
  }

  const data = (await res.json()) as RawRevision[];
  return Array.isArray(data) ? data.map(mapRevision) : [];
}

/** Creates a new revision via API. */
export async function createRevision(payload: CreateRevisionPayload): Promise<Revision> {
  const body = {
    serviceId: payload.serviceId,
    scheduledAt: toIsoScheduledAt(payload.scheduledAt),
    notes: payload.notes || undefined,
  };

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/revisions`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Não foi possível falar com o servidor.");
  }

  if (!res.ok) {
    throw new Error(await readError(res, "Não foi possível criar a revisão."));
  }

  return mapRevision((await res.json()) as RawRevision);
}

/** Updates an existing revision via API. */
export async function updateRevision(
  id: string,
  payload: UpdateRevisionPayload,
): Promise<Revision> {
  const body = {
    scheduledAt: payload.scheduledAt ? toIsoScheduledAt(payload.scheduledAt) : undefined,
    notes: payload.notes ?? null,
  };

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/revisions/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Não foi possível falar com o servidor.");
  }

  if (!res.ok) {
    throw new Error(await readError(res, "Não foi possível salvar a revisão."));
  }

  return mapRevision((await res.json()) as RawRevision);
}

/** Changes the status of a revision via API. */
export async function changeRevisionStatus(
  id: string,
  status: RevisionStatus,
): Promise<Revision> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/revisions/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  } catch {
    throw new Error("Não foi possível falar com o servidor.");
  }

  if (!res.ok) {
    throw new Error(await readError(res, "Não foi possível alterar o status da revisão."));
  }

  return mapRevision((await res.json()) as RawRevision);
}
