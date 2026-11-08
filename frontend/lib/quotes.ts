/**
 * Quote data layer — thin client for the quotes API.
 *
 * Contract (api/src/routes/quote.route.ts):
 *   GET /api/quotes      -> Quote[] (client summary + item count)
 *   GET /api/quotes/:id  -> Quote with items
 * All routes require an active session and role ADMIN or PLANNING;
 * a TECHNICIAN receives 403. Error shape is { error, fields: [{ path, message }] }.
 *
 * The API serializes the Prisma Decimal columns as strings ("123.45").
 * Money is converted to integer cents once, here at the boundary, so the
 * screens never do floating-point currency arithmetic.
 *
 * The API still has no endpoints to send a quote, record its decision or
 * upload evidence, and quotes have no sequential number yet — those join
 * lib/quotes.ts as the backend delivers them.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type QuoteStatus = "DRAFT" | "SENT" | "APPROVED" | "REJECTED" | "EXPIRED";

export type QuoteItemType = "PRODUCT" | "SERVICE" | "OTHER";

export type QuoteItem = {
  id: string;
  quoteId: string;
  type: QuoteItemType;
  description: string;
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
  /** Line subtotal after the item discount (quantity × unit price − discount). */
  subtotalCents: number;
};

export type Quote = {
  id: string;
  clientId: string;
  clientName: string;
  status: QuoteStatus;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  notes: string | null;
  createdBy: string;
  sentAt: string | null;
  decidedAt: string | null;
  decisionNotes: string | null;
  decisionEvidenceUrl: string | null;
  createdAt: string;
  updatedAt: string;
  items: QuoteItem[];
};

export type QuoteListItem = Omit<Quote, "items"> & {
  itemCount: number;
};

/** Status metadata shared by the list, the detail and the dashboard. */
export const QUOTE_STATUS_META: Record<
  QuoteStatus,
  { label: string; badgeTone: "success" | "danger" | "info" | "warning" | "neutral" }
> = {
  DRAFT: { label: "Rascunho", badgeTone: "neutral" },
  SENT: { label: "Enviada", badgeTone: "info" },
  APPROVED: { label: "Aprovado", badgeTone: "success" },
  REJECTED: { label: "Rejeitado", badgeTone: "danger" },
  EXPIRED: { label: "Expirado", badgeTone: "neutral" },
};

export const QUOTE_ITEM_TYPE_META: Record<QuoteItemType, { label: string }> = {
  PRODUCT: { label: "Produto" },
  SERVICE: { label: "Serviço" },
  OTHER: { label: "Outro" },
};

/** A quote can still be edited only while no decision is recorded (RF08 / RN-ORC-02). */
export function isQuoteOpen(status: QuoteStatus): boolean {
  return status === "DRAFT" || status === "SENT";
}

/* ==========================================================================
   Mutations — used by the quote form (create/edit).
   ========================================================================== */

/** Wire format accepted by POST /api/quotes and the item endpoints. */
export type QuoteItemPayload = {
  type: QuoteItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
};

export type QuoteUpdateItemPayload = QuoteItemPayload & {
  id?: string;
};

export type CreateQuotePayload = {
  clientId: string;
  notes?: string | null;
  discount?: number;
  items?: QuoteItemPayload[];
};

export type UpdateQuotePayload = {
  notes?: string | null;
  discount?: number;
  items?: QuoteUpdateItemPayload[];
};

/** POST /api/quotes — creates a quote in DRAFT (201 with items). */
export async function createQuote(payload: CreateQuotePayload): Promise<Quote> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/quotes`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("Não foi possível falar com o servidor.");
  }
  if (!res.ok) {
    throw new Error(await readError(res, "Não foi possível criar o orçamento."));
  }
  return mapQuote((await res.json()) as RawQuote);
}

/** PATCH /api/quotes/:id — atomically updates notes, general discount and/or items. */
export async function updateQuote(
  id: string,
  payload: UpdateQuotePayload,
): Promise<Quote> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/quotes/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("Não foi possível falar com o servidor.");
  }
  if (!res.ok) {
    throw new Error(await readError(res, "Não foi possível salvar o orçamento."));
  }
  return mapQuote((await res.json()) as RawQuote);
}

/**
 * Synchronizes quote items individually via the item sub-routes when needed.
 */
export async function syncQuoteItems(
  quoteId: string,
  desired: QuoteUpdateItemPayload[],
  current: QuoteItem[],
): Promise<void> {
  const call = async (path: string, method: string, body?: unknown) => {
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/api/quotes/${path}`, {
        method,
        credentials: "include",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new Error("Não foi possível falar com o servidor.");
    }
    if (!res.ok && res.status !== 204) {
      throw new Error(await readError(res, "Não foi possível salvar os itens do orçamento."));
    }
  };

  const remaining = [...current];

  for (const desiredItem of desired) {
    const { id: desiredId, ...itemBody } = desiredItem;
    const matchIndex = desiredId
      ? remaining.findIndex((item) => item.id === desiredId)
      : remaining.findIndex(
          (item) =>
            item.type === itemBody.type &&
            item.description.trim() === itemBody.description.trim(),
        );
    if (matchIndex >= 0) {
      const existing = remaining[matchIndex];
      remaining.splice(matchIndex, 1);
      await call(`${quoteId}/items/${existing.id}`, "PATCH", itemBody);
    } else {
      await call(`${quoteId}/items`, "POST", itemBody);
    }
  }

  for (const removed of remaining) {
    await call(`${quoteId}/items/${removed.id}`, "DELETE");
  }
}

/** DELETE /api/quotes/:id — only DRAFT quotes can be deleted (409 otherwise). */
export async function deleteQuote(id: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/quotes/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
  } catch {
    throw new Error("Não foi possível falar com o servidor.");
  }
  if (!res.ok && res.status !== 204) {
    throw new Error(await readError(res, "Não foi possível excluir o orçamento."));
  }
}

/* ==========================================================================
   Clients — options for the quote form select (GET /api/clients).
   ========================================================================== */

export type QuoteClientOption = { id: string; name: string };

/** Lists active clients for the quote form select. */
export async function listQuoteClients(): Promise<QuoteClientOption[]> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/clients`, { credentials: "include" });
  } catch {
    throw new Error("Não foi possível falar com o servidor.");
  }
  if (!res.ok) {
    throw new Error(await readError(res, "Não foi possível carregar os clientes."));
  }
  const data = (await res.json()) as { id: string; name: string; active?: boolean }[];
  return (Array.isArray(data) ? data : [])
    .filter((client) => client.active !== false)
    .map((client) => ({ id: client.id, name: client.name }));
}

/* ==========================================================================
   HTTP plumbing — same conventions as the clients screen.
   ========================================================================== */

/** Reads the API error body, falling back to a status-based message. */
async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    /* Zod validation errors */
    if (Array.isArray(body?.fields) && body.fields.length > 0) {
      return body.fields
        .map((f: { path: string; message: string }) => f.message)
        .join(" ");
    }
    if (typeof body?.error === "string") return body.error;
    if (typeof body?.message === "string") return body.message;
  } catch {
    /* Body não é JSON */
  }
  if (res.status === 401) return "Sessão expirada. Entre novamente.";
  if (res.status === 403) {
    return "Acesso negado: seu perfil não pode gerenciar orçamentos.";
  }
  return `${fallback} (Status HTTP: ${res.status})`;
}

/** Converts a serialized Decimal ("123.45" or 123.45) to integer cents. */
const toCents = (value: string | number): number => Math.round(Number(value) * 100);

/* Wire format of the API responses (quoteListSelect / quoteDetailSelect). */
type RawQuoteItem = {
  id: string;
  quoteId: string;
  type: QuoteItemType;
  description: string;
  quantity: string | number;
  unitPrice: string | number;
  discount: string | number;
  subtotal: string | number;
};

type RawQuote = {
  id: string;
  clientId: string;
  status: QuoteStatus;
  subtotal: string | number;
  discount: string | number;
  total: string | number;
  notes: string | null;
  createdBy: string;
  sentAt: string | null;
  decidedAt: string | null;
  decisionNotes: string | null;
  decisionEvidenceUrl: string | null;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string };
  items?: RawQuoteItem[];
  _count?: { items: number };
};

function mapItem(raw: RawQuoteItem): QuoteItem {
  return {
    id: raw.id,
    quoteId: raw.quoteId,
    type: raw.type,
    description: raw.description,
    quantity: Number(raw.quantity),
    unitPriceCents: toCents(raw.unitPrice),
    discountCents: toCents(raw.discount),
    subtotalCents: toCents(raw.subtotal),
  };
}

function mapQuote(raw: RawQuote): Quote {
  return {
    id: raw.id,
    clientId: raw.clientId,
    clientName: raw.client?.name ?? "",
    status: raw.status,
    subtotalCents: toCents(raw.subtotal),
    discountCents: toCents(raw.discount),
    totalCents: toCents(raw.total),
    notes: raw.notes,
    createdBy: raw.createdBy,
    sentAt: raw.sentAt,
    decidedAt: raw.decidedAt,
    decisionNotes: raw.decisionNotes,
    decisionEvidenceUrl: raw.decisionEvidenceUrl,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    items: (raw.items ?? []).map(mapItem),
  };
}

function mapListItem(raw: RawQuote): QuoteListItem {
  const quote = mapQuote(raw);
  return { ...quote, itemCount: raw._count?.items ?? 0 };
}

/** Lists all quotes. The API has no search parameter yet (RF22), so the screens filter client-side. */
export async function listQuotes(): Promise<QuoteListItem[]> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/quotes`, {
      credentials: "include",
    });
  } catch {
    throw new Error("Não foi possível falar com o servidor.");
  }
  if (!res.ok) {
    throw new Error(await readError(res, "Não foi possível carregar os orçamentos."));
  }
  const data = (await res.json()) as RawQuote[];
  return Array.isArray(data) ? data.map(mapListItem) : [];
}

/**
 * Fetches one quote with its items.
 * Returns null on 404 so the screen can show its own not-found message.
 */
export async function getQuote(id: string): Promise<Quote | null> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/quotes/${id}`, {
      credentials: "include",
    });
  } catch {
    throw new Error("Não foi possível falar com o servidor.");
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(await readError(res, "Não foi possível carregar o orçamento."));
  }
  return mapQuote((await res.json()) as RawQuote);
}

export async function sendQuoteApi(id: string): Promise<Quote> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/quotes/${id}/send`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    throw new Error("Não foi possível falar com o servidor.");
  }
  if (!res.ok) {
    throw new Error(await readError(res, "Não foi possível enviar o orçamento."));
  }
  return mapQuote((await res.json()) as RawQuote);
}

export async function approveQuoteApi(
  id: string,
  payload: { decisionNotes?: string; decisionEvidenceUrl?: string } = {}
): Promise<Quote> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/quotes/${id}/approve`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("Não foi possível falar com o servidor.");
  }
  if (!res.ok) {
    throw new Error(await readError(res, "Não foi possível aprovar o orçamento."));
  }
  return mapQuote((await res.json()) as RawQuote);
}

export async function rejectQuoteApi(
  id: string,
  payload: { decisionNotes: string; decisionEvidenceUrl?: string }
): Promise<Quote> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/quotes/${id}/reject`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("Não foi possível falar com o servidor.");
  }
  if (!res.ok) {
    throw new Error(await readError(res, "Não foi possível rejeitar o orçamento."));
  }
  return mapQuote((await res.json()) as RawQuote);
}