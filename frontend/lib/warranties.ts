/**
 * Warranty data layer — thin client for the warranties API.
 *
 * Dates are stored as "YYYY-MM-DD" strings; display formatting is handled
 * by the screen via `formatDateOnly` from `lib/money.ts`.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type WarrantyType = "SERVICE" | "MANUFACTURER";

export type Warranty = {
  id: string;
  serviceId: string;
  serviceTitle: string;
  clientName: string;
  type: WarrantyType;
  startsAt: string;
  endsAt: string;
  description: string | null;
  manufacturer: string | null;
  productReference: string | null;
};

export type CreateWarrantyPayload = {
  serviceId: string;
  type: WarrantyType;
  startsAt: string;
  endsAt: string;
  description?: string | null;
  manufacturer?: string | null;
  productReference?: string | null;
};

export type UpdateWarrantyPayload = Omit<CreateWarrantyPayload, "serviceId">;

/** Badge tone metadata for warranty type. */
export const WARRANTY_TYPE_META: Record<WarrantyType, { label: string }> = {
  SERVICE: { label: "Serviço" },
  MANUFACTURER: { label: "Fabricante" },
};

/** Days threshold for the "expiring soon" filter. */
export const EXPIRING_SOON_DAYS = 30;

type RawWarranty = {
  id: string;
  serviceId: string;
  type: WarrantyType;
  startsAt: string;
  endsAt: string;
  description: string | null;
  manufacturer: string | null;
  productReference: string | null;
  notes?: string | null;
  service?: {
    id: string;
    title: string;
    client?: { id: string; name: string };
  };
};

function mapWarranty(raw: RawWarranty): Warranty {
  return {
    id: raw.id,
    serviceId: raw.serviceId,
    serviceTitle: raw.service?.title ?? "Serviço",
    clientName: raw.service?.client?.name ?? "Cliente",
    type: raw.type,
    startsAt: raw.startsAt ? raw.startsAt.slice(0, 10) : "",
    endsAt: raw.endsAt ? raw.endsAt.slice(0, 10) : "",
    description: raw.description,
    manufacturer: raw.manufacturer,
    productReference: raw.productReference,
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
  if (res.status === 403) return "Acesso negado: seu perfil não tem permissão para gerenciar garantias.";
  return `${fallback} (Status HTTP: ${res.status})`;
}

/** Lists all warranties from the API. */
export async function listWarranties(): Promise<Warranty[]> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/warranties`, {
      credentials: "include",
    });
  } catch {
    throw new Error("Não foi possível falar com o servidor.");
  }

  if (!res.ok) {
    throw new Error(await readError(res, "Não foi possível carregar as garantias."));
  }

  const data = (await res.json()) as RawWarranty[];
  return Array.isArray(data) ? data.map(mapWarranty) : [];
}

/** Creates a new warranty record via API. */
export async function createWarranty(payload: CreateWarrantyPayload): Promise<Warranty> {
  const isManufacturer = payload.type === "MANUFACTURER";
  const body = {
    serviceId: payload.serviceId,
    type: payload.type,
    startsAt: payload.startsAt,
    endsAt: payload.endsAt,
    description: payload.description || undefined,
    manufacturer: isManufacturer ? (payload.manufacturer || undefined) : undefined,
    productReference: isManufacturer ? (payload.productReference || undefined) : undefined,
  };

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/warranties`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Não foi possível falar com o servidor.");
  }

  if (!res.ok) {
    throw new Error(await readError(res, "Não foi possível criar a garantia."));
  }

  return mapWarranty((await res.json()) as RawWarranty);
}

/** Updates an existing warranty via API. */
export async function updateWarranty(
  id: string,
  payload: UpdateWarrantyPayload,
): Promise<Warranty> {
  const isManufacturer = payload.type === "MANUFACTURER";
  const body = {
    type: payload.type,
    startsAt: payload.startsAt,
    endsAt: payload.endsAt,
    description: payload.description ?? null,
    manufacturer: isManufacturer ? (payload.manufacturer ?? null) : null,
    productReference: isManufacturer ? (payload.productReference ?? null) : null,
  };

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/warranties/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Não foi possível falar com o servidor.");
  }

  if (!res.ok) {
    throw new Error(await readError(res, "Não foi possível salvar a garantia."));
  }

  return mapWarranty((await res.json()) as RawWarranty);
}
