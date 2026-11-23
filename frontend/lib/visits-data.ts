/**
 * Visit data layer — thin client for the visits API.
 *
 * PROPOSED CONTRACT (no backend implementation yet — only the ServiceVisit /
 * VisitTechnician Prisma models; validate with the API team before building):
 *   GET    /api/services/:serviceId/visits -> Visit[] (service detail already includes them)
 *   GET    /api/visits                     -> Visit[] (query: technicianId, serviceId, status, from, to;
 *                                                TECHNICIAN sessions must be scoped server-side)
 *   POST   /api/services/:serviceId/visits -> 201 Visit (body: scheduledStart, scheduledEnd?, description?, technicianIds[])
 *   PATCH  /api/visits/:id                 -> Visit    (reschedule, description, technicians)
 *   PATCH  /api/visits/:id/execution        -> Visit    (status transition + actualStart/actualEnd/notes — RF16)
 *   PATCH  /api/visits/:id/status           -> Visit    (cancel: SCHEDULED/IN_PROGRESS -> CANCELLED, ADMIN/PLANNING)
 *   GET    /api/technicians                 -> User[]   (role TECHNICIAN; /api/users is ADMIN-only today and
 *                                                PLANNING needs to list technicians to assign visits)
 *
 * Visit statuses are a proposal (the requirements do not enumerate them):
 * SCHEDULED -> IN_PROGRESS -> COMPLETED, with CANCELLED from the first two.
 *
 * Until the API implements these routes, calls fail with 404 and the screens
 * show a generic "Serviço indisponível. Contate o administrador." message —
 * no internal details, no mock data, nothing else to change when the API lands.
 */
import { listServices, type ServiceStatusValue } from "./services-data";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Generic message for routes the API does not serve yet — never expose internal details to users. */
const ROUTE_MISSING_MESSAGE = "Serviço indisponível. Contate o administrador.";

export type VisitStatusValue =
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

/** Allowed visit status changes (proposal; services use the same shape). */
export const VISIT_STATUS_TRANSITIONS: Record<
  VisitStatusValue,
  readonly VisitStatusValue[]
> = {
  SCHEDULED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export type VisitTechnicianRef = { id: string; name: string };

export type VisitServiceRef = {
  id: string;
  title: string;
  status: ServiceStatusValue;
  origin: string;
  client: { id: string; name: string; location: string };
};

export type Visit = {
  id: string;
  serviceId: string;
  service: VisitServiceRef;
  scheduledStart: string;
  scheduledEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  status: VisitStatusValue;
  description: string | null;
  notes: string | null;
  technicians: VisitTechnicianRef[];
  createdAt: string;
  updatedAt: string;
};

export type VisitListQuery = {
  technicianId?: string;
  serviceId?: string;
  status?: VisitStatusValue;
  /** ISO boundaries applied to scheduledStart. */
  from?: string;
  to?: string;
};

export type VisitFormPayload = {
  serviceId: string;
  scheduledStart: string;
  scheduledEnd?: string | null;
  description?: string | null;
  /** RN-SRV-03: one visit can have several technicians. */
  technicianIds: string[];
};

export type VisitEditPayload = {
  scheduledStart?: string;
  scheduledEnd?: string | null;
  description?: string | null;
  technicianIds?: string[];
};

/* ==========================================================================
   HTTP plumbing — same conventions as lib/quotes.ts.
   ========================================================================== */

/** Reads the API error body, falling back to a status-based message. */
async function readError(
  res: Response,
  fallback: string,
  routeMissing?: string,
): Promise<string> {
  try {
    const body = await res.json();
    /* Zod validation errors arrive as { error, fields: [{ path, message }] }. */
    if (Array.isArray(body?.fields) && body.fields.length > 0) {
      return body.fields
        .map((f: { path: string; message: string }) => f.message)
        .join(" ");
    }
    if (typeof body?.error === "string") return body.error;
  } catch {
    /* Body was not JSON (e.g. a plain 404 page); use the status-based message. */
  }
  if (res.status === 401) return "Sessão expirada. Entre novamente.";
  if (res.status === 403) {
    return "Acesso negado: seu perfil não tem permissão para esta operação.";
  }
  if (res.status === 404 && routeMissing) return routeMissing;
  return fallback;
}

async function request(
  path: string,
  init: RequestInit,
  fallback: string,
  routeMissing?: string,
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      ...init,
    });
  } catch {
    /* Network failure: the API is down or unreachable. */
    throw new Error("Não foi possível falar com o servidor.");
  }
  if (!res.ok) {
    throw new Error(await readError(res, fallback, routeMissing));
  }
  return res;
}

/* ==========================================================================
   Endpoints
   ========================================================================== */

export async function listVisits(
  query: VisitListQuery = {},
): Promise<Visit[]> {
  const params = new URLSearchParams();
  if (query.technicianId) params.set("technicianId", query.technicianId);
  if (query.serviceId) params.set("serviceId", query.serviceId);
  if (query.status) params.set("status", query.status);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  const qs = params.toString();

  const res = await request(
    `/api/visits${qs ? `?${qs}` : ""}`,
    { method: "GET" },
    "Não foi possível carregar as visitas.",
    ROUTE_MISSING_MESSAGE,
  );
  const data = (await res.json()) as Visit[];
  return Array.isArray(data) ? data : [];
}

export async function createVisit(payload: VisitFormPayload): Promise<Visit> {
  const res = await request(
    `/api/services/${payload.serviceId}/visits`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scheduledStart: payload.scheduledStart,
        scheduledEnd: payload.scheduledEnd ?? null,
        description: payload.description ?? null,
        technicianIds: payload.technicianIds,
      }),
    },
    "Não foi possível agendar a visita.",
    ROUTE_MISSING_MESSAGE,
  );
  return (await res.json()) as Visit;
}

export async function updateVisit(
  id: string,
  patch: VisitEditPayload,
): Promise<Visit> {
  const res = await request(
    `/api/visits/${id}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
    "Não foi possível salvar a visita.",
  );
  return (await res.json()) as Visit;
}

/** RF16: the technician records the real start; the API stamps IN_PROGRESS. */
export async function recordVisitStart(id: string): Promise<Visit> {
  const res = await request(
    `/api/visits/${id}/execution`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "IN_PROGRESS",
        actualStart: new Date().toISOString(),
      }),
    },
    "Não foi possível registrar o início da visita.",
  );
  return (await res.json()) as Visit;
}

/** RF16: managerial conclusion — never replaces the official external OS. */
export async function recordVisitCompletion(
  id: string,
  notes?: string | null,
): Promise<Visit> {
  const res = await request(
    `/api/visits/${id}/execution`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "COMPLETED",
        actualEnd: new Date().toISOString(),
        ...(notes ? { notes } : {}),
      }),
    },
    "Não foi possível registrar a conclusão da visita.",
  );
  return (await res.json()) as Visit;
}

/** Cancel is a planning action (ADMIN/PLANNING), not a technician one. */
export async function cancelVisit(id: string): Promise<Visit> {
  const res = await request(
    `/api/visits/${id}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    },
    "Não foi possível cancelar a visita.",
  );
  return (await res.json()) as Visit;
}

/* ==========================================================================
   Auxiliary data (services list exists on feat/api-services; technicians
   endpoint is part of the proposed contract)
   ========================================================================== */

export type TechnicianOption = { id: string; name: string };

/** GET /api/technicians (proposed) — /api/users is ADMIN-only today. */
export async function listTechnicians(): Promise<TechnicianOption[]> {
  const res = await request(
    "/api/technicians",
    { method: "GET" },
    "Não foi possível carregar os técnicos.",
    ROUTE_MISSING_MESSAGE,
  );
  const data = (await res.json()) as { id: string; name: string }[];
  return (Array.isArray(data) ? data : []).map((technician) => ({
    id: technician.id,
    name: technician.name,
  }));
}

export type SchedulableServiceOption = {
  id: string;
  title: string;
  clientName: string;
  status: ServiceStatusValue;
};

/** GET /api/services — open services (PLANNED/IN_PROGRESS) can receive visits. */
export async function listSchedulableServices(): Promise<
  SchedulableServiceOption[]
> {
  const services = await listServices();
  return services
    .filter(
      (service) =>
        service.status === "PLANNED" || service.status === "IN_PROGRESS",
    )
    .map((service) => ({
      id: service.id,
      title: service.title,
      clientName: service.client.name,
      status: service.status,
    }))
    .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
}
