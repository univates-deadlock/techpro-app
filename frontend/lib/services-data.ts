/**
 * Service data layer — thin client for the services API.
 *
 * Contract (api/src/routes/service.route.ts — merged to main in PR #112):
 *   GET    /api/services             -> ServiceListItem[] (query: clientId, status, origin, q, from, to)
 *   POST   /api/services             -> 201 ServiceRecord  (RN-SRV-01: origin QUOTE requires an approved quote)
 *   PATCH  /api/services/:id         -> ServiceRecord      (open services; closed ones accept only externalOsNumber)
 *   PATCH  /api/services/:id/status  -> ServiceRecord      (see SERVICE_STATUS_TRANSITIONS)
 *
 * All routes require an active session and role ADMIN or PLANNING (a
 * TECHNICIAN receives 403). Error shape is { error, fields?: [{ path, message }] }.
 *
 * The services API ships on main since PR #112, so these routes exist and the
 * screens call them directly. Anything the API does not serve yet still shows
 * the generic "Serviço indisponível. Contate o administrador." message — no
 * internal details, no mock data.
 */
import { listQuotes } from "./quotes";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Generic message for routes the API does not serve yet — never expose internal details to users. */
const ROUTE_MISSING_MESSAGE = "Serviço indisponível. Contate o administrador.";

export type ServiceOriginValue =
  | "QUOTE"
  | "SUPPORT"
  | "MAINTENANCE"
  | "REVISION"
  | "WARRANTY"
  | "OTHER";

export type ServiceStatusValue =
  | "PLANNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

/** Allowed status changes (mirrors api/src/services/service.service.ts). */
export const SERVICE_STATUS_TRANSITIONS: Record<
  ServiceStatusValue,
  readonly ServiceStatusValue[]
> = {
  PLANNED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export type ServiceClientRef = {
  id: string;
  name: string;
  type: "INDIVIDUAL" | "COMPANY";
  location: string;
};

/** quote relation returned by the API (Decimal total serialized as string). */
export type ServiceQuoteRef = {
  id: string;
  status: string;
  total: string;
} | null;

/** Row shape returned by GET /api/services (serviceListSelect). */
export type ServiceListItem = {
  id: string;
  clientId: string;
  quoteId: string | null;
  origin: ServiceOriginValue;
  status: ServiceStatusValue;
  title: string;
  description: string | null;
  externalOsNumber: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  completedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  client: ServiceClientRef;
  quote: ServiceQuoteRef;
  _count: { visits: number };
};

/** Shape returned by the mutations (serviceDetailSelect, without _count). */
export type ServiceRecord = Omit<ServiceListItem, "_count">;

export type ServiceListQuery = {
  clientId?: string;
  status?: ServiceStatusValue;
  origin?: ServiceOriginValue;
  /** Free text: matches title, external OS number or client name. */
  q?: string;
  /** ISO boundaries applied to plannedStart. */
  from?: string;
  to?: string;
};

export type ServiceFormPayload = {
  origin: ServiceOriginValue;
  clientId?: string | null;
  quoteId?: string | null;
  title: string;
  description?: string | null;
  externalOsNumber?: string | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
};

/** Fields editable after creation (mirrors updateServiceSchema). */
export type ServiceEditPayload = Partial<
  Pick<
    ServiceFormPayload,
    "title" | "description" | "externalOsNumber" | "plannedStart" | "plannedEnd"
  >
>;

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
    return "Acesso negado: apenas Administrador e Planejamento gerenciam serviços.";
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

/* Wire format of the API responses (serviceListSelect / serviceDetailSelect). */
type RawService = Omit<ServiceListItem, "_count"> & {
  _count?: { visits: number };
};

function mapService(raw: RawService): ServiceListItem {
  return { ...raw, _count: raw._count ?? { visits: 0 } };
}

/* ==========================================================================
   Endpoints
   ========================================================================== */

export async function listServices(
  query: ServiceListQuery = {},
): Promise<ServiceListItem[]> {
  const params = new URLSearchParams();
  if (query.clientId) params.set("clientId", query.clientId);
  if (query.status) params.set("status", query.status);
  if (query.origin) params.set("origin", query.origin);
  if (query.q) params.set("q", query.q);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  const qs = params.toString();

  const res = await request(
    `/api/services${qs ? `?${qs}` : ""}`,
    { method: "GET" },
    "Não foi possível carregar os serviços.",
    ROUTE_MISSING_MESSAGE,
  );
  const data = (await res.json()) as RawService[];
  return Array.isArray(data) ? data.map(mapService) : [];
}

export async function createService(
  payload: ServiceFormPayload,
): Promise<ServiceListItem> {
  /* createServiceSchema is a strictObject: send clientId OR quoteId
     (RN-SRV-01) — never null for the uuid fields. */
  const body = {
    origin: payload.origin,
    ...(payload.origin === "QUOTE"
      ? { quoteId: payload.quoteId }
      : { clientId: payload.clientId }),
    title: payload.title,
    description: payload.description ?? null,
    externalOsNumber: payload.externalOsNumber ?? null,
    plannedStart: payload.plannedStart ?? null,
    plannedEnd: payload.plannedEnd ?? null,
  };

  const res = await request(
    "/api/services",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    "Não foi possível criar o serviço.",
    ROUTE_MISSING_MESSAGE,
  );
  return mapService((await res.json()) as RawService);
}

export async function updateService(
  id: string,
  patch: ServiceEditPayload,
): Promise<ServiceListItem> {
  const res = await request(
    `/api/services/${id}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
    "Não foi possível salvar o serviço.",
  );
  return mapService((await res.json()) as RawService);
}

export async function updateServiceStatus(
  id: string,
  status: ServiceStatusValue,
): Promise<ServiceListItem> {
  const res = await request(
    `/api/services/${id}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    },
    "Não foi possível alterar o status do serviço.",
  );
  return mapService((await res.json()) as RawService);
}

/* ==========================================================================
   Auxiliary data for the service form (endpoints that exist on main)
   ========================================================================== */

export type ServiceClientOption = { id: string; name: string; location: string };

/** GET /api/clients — active clients for the direct-service select. */
export async function listClientsForService(): Promise<ServiceClientOption[]> {
  const res = await request(
    "/api/clients",
    { method: "GET" },
    "Não foi possível carregar os clientes.",
  );
  const data = (await res.json()) as {
    id: string;
    name: string;
    location: string;
    active?: boolean;
  }[];
  return (Array.isArray(data) ? data : [])
    .filter((client) => client.active !== false)
    .map((client) => ({
      id: client.id,
      name: client.name,
      location: client.location,
    }));
}

export type ApprovedQuoteOption = {
  id: string;
  clientId: string;
  clientName: string;
  totalCents: number;
};

/**
 * GET /api/quotes (exists on main) — approved quotes without a linked service
 * (the quote -> service relation is 1:1). If the services route is not
 * deployed yet, the linked filter degrades gracefully: the API revalidates
 * on create ("Já existe um serviço para este orçamento", 409).
 */
export async function listApprovedQuotesWithoutService(): Promise<
  ApprovedQuoteOption[]
> {
  const quotes = await listQuotes();
  let linkedQuoteIds = new Set<string>();
  try {
    const services = await listServices();
    linkedQuoteIds = new Set(
      services
        .map((service) => service.quoteId)
        .filter((quoteId): quoteId is string => Boolean(quoteId)),
    );
  } catch {
    /* Services route may be missing; keep listing the approved quotes. */
  }
  return quotes
    .filter((quote) => quote.status === "APPROVED")
    .filter((quote) => !linkedQuoteIds.has(quote.id))
    .map((quote) => ({
      id: quote.id,
      clientId: quote.clientId,
      clientName: quote.clientName,
      totalCents: quote.totalCents,
    }));
}
