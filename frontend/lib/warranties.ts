/**
 * Warranty data layer — thin client for the warranties API.
 *
 * Dates are stored as "YYYY-MM-DD" strings; display formatting is handled
 * by the screen via `formatDateOnly` from `lib/money.ts`.
 */

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
// TODO: align with the backend rule at integration
export const EXPIRING_SOON_DAYS = 30;

let nextId = 5;

const MOCK_WARRANTIES: Warranty[] = [
  {
    id: "war-001",
    serviceId: "svc-001",
    serviceTitle: "Instalação CFTV Loja Centro",
    clientName: "Maria Souza",
    type: "SERVICE",
    startsAt: "2024-01-15",
    endsAt: "2025-01-15",
    description: "Garantia de mão de obra da instalação",
    manufacturer: null,
    productReference: null,
  },
  {
    id: "war-002",
    serviceId: "svc-002",
    serviceTitle: "Manutenção Alarme Galpão",
    clientName: "Tech Solutions LTDA",
    type: "MANUFACTURER",
    startsAt: "2026-06-01",
    endsAt: "2026-12-15",
    description: "Garantia do painel de alarme",
    manufacturer: "Intelbras",
    productReference: "AMT 8000",
  },
  {
    id: "war-003",
    serviceId: "svc-003",
    serviceTitle: "Cerca Elétrica Residência",
    clientName: "João Silva",
    type: "SERVICE",
    startsAt: "2026-10-01",
    endsAt: "2028-10-01",
    description: null,
    manufacturer: null,
    productReference: null,
  },
  {
    id: "war-004",
    serviceId: "svc-001",
    serviceTitle: "Instalação CFTV Loja Centro",
    clientName: "Maria Souza",
    type: "MANUFACTURER",
    startsAt: "2026-03-01",
    endsAt: "2026-03-01",
    description: "Cancelada por substituição de equipamento",
    manufacturer: "Hikvision",
    productReference: "DS-2CD2143G2-I",
  },
];

/** Lists all warranties. */
export async function listWarranties(): Promise<Warranty[]> {
  // MOCK: replace with fetch to GET /api/warranties (integration pending)
  return MOCK_WARRANTIES;
}

/** Creates a new warranty record. */
export async function createWarranty(payload: CreateWarrantyPayload): Promise<Warranty> {
  // MOCK: replace with fetch to POST /api/warranties (integration pending)
  const service = MOCK_WARRANTIES.find((w) => w.serviceId === payload.serviceId);
  const created: Warranty = {
    id: `war-${String(nextId++).padStart(3, "0")}`,
    serviceId: payload.serviceId,
    serviceTitle: service?.serviceTitle ?? "Serviço",
    clientName: service?.clientName ?? "Cliente",
    type: payload.type,
    startsAt: payload.startsAt,
    endsAt: payload.endsAt,
    description: payload.description ?? null,
    manufacturer: payload.manufacturer ?? null,
    productReference: payload.productReference ?? null,
  };
  MOCK_WARRANTIES.push(created);
  return created;
}

/** Updates an existing warranty. */
export async function updateWarranty(
  id: string,
  payload: UpdateWarrantyPayload,
): Promise<Warranty> {
  // MOCK: replace with fetch to PATCH /api/warranties/:id (integration pending)
  const index = MOCK_WARRANTIES.findIndex((w) => w.id === id);
  if (index === -1) throw new Error("Garantia não encontrada.");
  const updated: Warranty = {
    ...MOCK_WARRANTIES[index],
    type: payload.type,
    startsAt: payload.startsAt,
    endsAt: payload.endsAt,
    description: payload.description ?? null,
    manufacturer: payload.manufacturer ?? null,
    productReference: payload.productReference ?? null,
  };
  MOCK_WARRANTIES[index] = updated;
  return updated;
}
