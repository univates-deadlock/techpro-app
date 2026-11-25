/**
 * Visit data layer — thin client for the visits API (PR #116).
 *
 * IMPLEMENTED CONTRACT (api/src/routes/visit.route.ts, branch feat/api-visit-scheduling):
 *   GET    /api/services/:serviceId/visits -> Visit[] (ordered by scheduledStart)
 *   GET    /api/visits                     -> Visit[] (query: serviceId, technicianId, status, from, to;
 *                                                ADMIN and PLANNING only — TECHNICIAN gets 403)
 *   POST   /api/services/:serviceId/visits -> 201 Visit (body: scheduledStart, scheduledEnd?,
 *                                                description?, notes?, technicianIds?, confirmConflicts?)
 *   PATCH  /api/visits/:id                 -> Visit    (scheduledStart?, scheduledEnd?, description?,
 *                                                notes?, confirmConflicts? — SCHEDULED visits only)
 *   PUT    /api/visits/:id/technicians     -> Visit    (replaces the whole technician list; body:
 *                                                technicianIds, confirmConflicts?)
 *
 * Technician schedule conflicts are NOT request errors: when a technician already
 * has another non-cancelled visit overlapping the window, the API saves nothing
 * and answers 409 with the conflict list. The client repeats the SAME request
 * with confirmConflicts: true to schedule anyway (see VisitConflictError below).
 *
 * NOT SERVED BY THE API YET (execution is remaining work of issue #72 — the UI
 * must not present these flows as available, per docs/entrega-final.md):
 *   PATCH  /api/visits/:id/execution        (status transition + actualStart/actualEnd — RF16)
 *   PATCH  /api/visits/:id/status           (cancel: SCHEDULED/IN_PROGRESS -> CANCELLED)
 *   GET    /api/technicians                 (active technicians for ADMIN/PLANNING; /api/users
 *                                                is ADMIN-only today, so PLANNING cannot list
 *                                                technicians until this route exists)
 * The functions for these routes stay here behind VISIT_EXECUTION_API_ENABLED /
 * a graceful fallback so they light up when the API team delivers them.
 */
import { listServices, type ServiceStatusValue } from "./services-data";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Generic message for routes the API does not serve yet — never expose internal details to users. */
const ROUTE_MISSING_MESSAGE = "Serviço indisponível. Contate o administrador.";

/**
 * Execution endpoints (real start/end, status transitions, cancellation) are
 * remaining work of issue #72. While false, the visit screens hide the
 * execution and cancellation actions (docs/entrega-final.md: these flows must
 * not be presented as available in the browser). Flip to true once the API
 * serves /api/visits/:id/execution and /api/visits/:id/status.
 */
export const VISIT_EXECUTION_API_ENABLED = false;

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

/**
 * Technician link as returned by the API (visitSelect): each item nests the
 * technician one level down — [{ technician: { id, name } }], NOT a flat
 * { id, name } list (see the integration tests: item.technician.id).
 */
export type VisitTechnicianLink = { technician: VisitTechnicianRef };

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
  technicians: VisitTechnicianLink[];
  createdAt: string;
  updatedAt: string;
};

/** Conflict reported by the API: the technician is already booked in the listed visit. */
export type VisitConflict = {
  technician: { id: string; name: string };
  visit: {
    id: string;
    serviceId: string;
    serviceTitle: string;
    scheduledStart: string;
    scheduledEnd: string | null;
  };
};

/**
 * The API answered 409 because a technician has a schedule conflict and
 * nothing was saved. The user can retry the same request with
 * confirmConflicts: true (see visit.controller.ts in the API).
 */
export class VisitConflictError extends Error {
  readonly conflicts: VisitConflict[];

  constructor(message: string, conflicts: VisitConflict[]) {
    super(message);
    this.name = "VisitConflictError";
    this.conflicts = conflicts;
  }
}

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
  /** RN-SRV-03: one visit can have several technicians (optional — may be empty). */
  technicianIds: string[];
  /** Re-send with true to confirm the schedule despite the reported conflicts. */
  confirmConflicts?: boolean;
};

/**
 * PATCH /api/visits/:id body. The API schema is a strictObject: technicianIds
 * is NOT accepted here — replacing the list is PUT /api/visits/:id/technicians.
 */
export type VisitEditPayload = {
  scheduledStart?: string;
  scheduledEnd?: string | null;
  description?: string | null;
  confirmConflicts?: boolean;
};

/** PUT /api/visits/:id/technicians body — replaces the whole technician list. */
export type VisitTechniciansPayload = {
  technicianIds: string[];
  confirmConflicts?: boolean;
};

/* ==========================================================================
   HTTP plumbing — same conventions as lib/quotes.ts.
   ========================================================================== */

type ErrorBody = {
  error?: unknown;
  fields?: { path: string; message: string }[];
  conflicts?: VisitConflict[];
};

/** Builds the user-facing message from an already parsed error body. */
function errorMessage(
  body: ErrorBody | null,
  res: Response,
  fallback: string,
  routeMissing?: string,
): string {
  /* Zod validation errors arrive as { error, fields: [{ path, message }] }. */
  if (Array.isArray(body?.fields) && body.fields.length > 0) {
    return body.fields.map((f) => f.message).join(" ");
  }
  if (typeof body?.error === "string" && body.error) return body.error;
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
    let body: ErrorBody | null = null;
    try {
      body = (await res.json()) as ErrorBody | null;
    } catch {
      /* Body was not JSON (e.g. a plain 404 page). */
    }
    /* 409 WITH a conflict list is the confirmation rule, not a plain error:
       nothing was saved and the request must be repeated with confirmConflicts. */
    if (res.status === 409 && Array.isArray(body?.conflicts)) {
      throw new VisitConflictError(
        typeof body?.error === "string" && body.error
          ? body.error
          : "Há conflito de horário para técnicos desta visita.",
        body.conflicts,
      );
    }
    throw new Error(errorMessage(body, res, fallback, routeMissing));
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
        ...(payload.confirmConflicts ? { confirmConflicts: true } : {}),
      }),
    },
    "Não foi possível agendar a visita.",
    ROUTE_MISSING_MESSAGE,
  );
  return (await res.json()) as Visit;
}

/**
 * Edit / reschedule a SCHEDULED visit. Only time and text fields belong here;
 * technician changes go through setVisitTechnicians (the API PATCH is a
 * strictObject and rejects technicianIds with 400).
 */
export async function updateVisit(
  id: string,
  patch: VisitEditPayload,
): Promise<Visit> {
  const res = await request(
    `/api/visits/${id}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...patch,
        ...(patch.confirmConflicts ? { confirmConflicts: true } : {}),
      }),
    },
    "Não foi possível salvar a visita.",
  );
  return (await res.json()) as Visit;
}

/**
 * Replace the whole technician list of a visit (PUT). Technicians missing from
 * the list are unassigned; an empty list removes everyone. Conflicts are
 * checked for the newly added technicians only.
 *
 * NOTE: kept for when the backend fixes the API CORS (api/src/utils/cors.ts
 * does not list the PUT method yet, so browsers block the preflight request
 * for this endpoint). The visit screens do NOT call it until then; technician
 * changes are only possible on visit creation (POST).
 */
export async function setVisitTechnicians(
  id: string,
  payload: VisitTechniciansPayload,
): Promise<Visit> {
  const res = await request(
    `/api/visits/${id}/technicians`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        technicianIds: payload.technicianIds,
        ...(payload.confirmConflicts ? { confirmConflicts: true } : {}),
      }),
    },
    "Não foi possível salvar os técnicos da visita.",
  );
  return (await res.json()) as Visit;
}

/* RF16 — execution endpoints (remaining work of #72, see the header comment). */

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
    ROUTE_MISSING_MESSAGE,
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
    ROUTE_MISSING_MESSAGE,
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
    ROUTE_MISSING_MESSAGE,
  );
  return (await res.json()) as Visit;
}

/* ==========================================================================
   Auxiliary data (services list exists on main; the technicians route is
   part of the remaining work of #72)
   ========================================================================== */

export type TechnicianOption = { id: string; name: string };

type ApiUser = { id: string; name: string; role: string; isActive: boolean };

/**
 * GET /api/technicians (remaining work of #72 — /api/users is ADMIN-only today).
 *
 * While the route does not exist, ADMIN sessions fall back to GET /api/users
 * (client-side filter: active technicians only) so scheduling keeps working.
 * PLANNING sessions get 403 there too and see a degraded notice in the UI
 * instead of a broken assignment list — no fake data is ever shown.
 */
export async function listTechnicians(): Promise<TechnicianOption[]> {
  try {
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
  } catch {
    /* Route not served yet: ADMIN can still list users and filter client-side.
       Any failure here (e.g. PLANNING 403) propagates so the UI shows the
       degraded notice. */
    const res = await request(
      "/api/users",
      { method: "GET" },
      "Não foi possível carregar os técnicos.",
    );
    const data = (await res.json()) as ApiUser[];
    return (Array.isArray(data) ? data : [])
      .filter((user) => user.role === "TECHNICIAN" && user.isActive)
      .map(({ id, name }) => ({ id, name }));
  }
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
