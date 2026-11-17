import { prisma } from "../lib/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type {
  CreateServiceInput,
  ListServicesQuery,
  ServiceStatusValue,
  UpdateServiceInput,
} from "../schemas/service.schema.js";
import { AppError } from "../utils/AppError.js";

// 1) ============= Selects =============
const serviceBaseSelect = {
  id: true,
  clientId: true,
  quoteId: true,
  origin: true,
  status: true,
  title: true,
  description: true,
  externalOsNumber: true,
  plannedStart: true,
  plannedEnd: true,
  completedAt: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  // The schema has no location on service/visit: the service location is the client's.
  client: { select: { id: true, name: true, type: true, location: true } },
  quote: { select: { id: true, status: true, total: true } },
} satisfies Prisma.ServiceSelect;

export const serviceListSelect = {
  ...serviceBaseSelect,
  _count: { select: { visits: true } },
} satisfies Prisma.ServiceSelect;

export const serviceDetailSelect = {
  ...serviceBaseSelect,
  visits: {
    select: {
      id: true,
      scheduledStart: true,
      scheduledEnd: true,
      actualStart: true,
      actualEnd: true,
      status: true,
      description: true,
      notes: true,
      technicians: { select: { technician: { select: { id: true, name: true } } } },
    },
    orderBy: [{ scheduledStart: "asc" }, { id: "asc" }],
  },
} satisfies Prisma.ServiceSelect;

// 2) ============= Internal helpers =============
// Allowed status changes. COMPLETED and CANCELLED are final.
const STATUS_TRANSITIONS: Record<ServiceStatusValue, readonly ServiceStatusValue[]> = {
  PLANNED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

const isClosed = (status: string) => status === "COMPLETED" || status === "CANCELLED";

// Locks the service row and ensures it exists (same pattern used for quotes).
const getServiceForUpdateOrThrow = async (tx: Prisma.TransactionClient, id: string) => {
  await tx.$queryRaw`SELECT "id" FROM "service" WHERE "id" = ${id}::uuid FOR UPDATE`;

  const service = await tx.service.findUnique({
    where: { id },
    select: { id: true, status: true, plannedStart: true, plannedEnd: true },
  });

  if (!service) {
    throw new AppError("Serviço não encontrado", 404);
  }

  return service;
};

// 3) ============= List services (optional filters) =============
export const getAllServices = async (filters: ListServicesQuery) =>
  prisma.service.findMany({
    where: {
      ...(filters.clientId && { clientId: filters.clientId }),
      ...(filters.status && { status: filters.status }),
      ...(filters.origin && { origin: filters.origin }),
      ...(filters.q && {
        OR: [
          { title: { contains: filters.q, mode: "insensitive" } },
          { externalOsNumber: { contains: filters.q, mode: "insensitive" } },
          { client: { name: { contains: filters.q, mode: "insensitive" } } },
        ],
      }),
      ...((filters.from || filters.to) && {
        plannedStart: {
          ...(filters.from && { gte: filters.from }),
          ...(filters.to && { lte: filters.to }),
        },
      }),
    },
    select: serviceListSelect,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });

// 4) ============= Search service by ID (with visits) =============
export const getServiceById = async (id: string) => {
  const service = await prisma.service.findUnique({ where: { id }, select: serviceDetailSelect });

  if (!service) {
    throw new AppError("Serviço não encontrado", 404);
  }

  return service;
};

// 5) ============= Create service (from approved quote or direct) =============
export const createService = async (data: CreateServiceInput, userId: string) =>
  prisma.$transaction(async (tx) => {
    let clientId = data.clientId;
    let quoteNotes: string | null = null;

    if (data.quoteId) {
      // Lock the quote so two requests can't create two services for it.
      await tx.$queryRaw`SELECT "id" FROM "quote" WHERE "id" = ${data.quoteId}::uuid FOR UPDATE`;

      const quote = await tx.quote.findUnique({
        where: { id: data.quoteId },
        select: { id: true, clientId: true, status: true, notes: true, service: { select: { id: true } } },
      });

      if (!quote) {
        throw new AppError("Orçamento não encontrado", 404);
      }

      if (quote.status !== "APPROVED") {
        throw new AppError("Só é possível criar serviço a partir de um orçamento aprovado", 409);
      }

      if (quote.service) {
        throw new AppError("Já existe um serviço para este orçamento", 409);
      }

      if (data.clientId && data.clientId !== quote.clientId) {
        throw new AppError("O orçamento informado pertence a outro cliente", 422);
      }

      clientId = quote.clientId;
      quoteNotes = quote.notes;
    }

    if (!clientId) {
      throw new AppError("Informe o cliente", 400);
    }

    const client = await tx.client.findUnique({
      where: { id: clientId },
      select: { id: true, active: true },
    });

    if (!client) {
      throw new AppError("Cliente não encontrado", 404);
    }

    if (!client.active) {
      throw new AppError("Não é possível criar serviço para um cliente inativo", 409);
    }

    return tx.service.create({
      data: {
        clientId,
        quoteId: data.quoteId ?? null,
        origin: data.origin,
        status: "PLANNED",
        title: data.title,
        // Reuses the quote notes when no description is given (RF09).
        description: data.description ?? quoteNotes,
        externalOsNumber: data.externalOsNumber ?? null,
        plannedStart: data.plannedStart ?? null,
        plannedEnd: data.plannedEnd ?? null,
        createdBy: userId,
      },
      select: serviceDetailSelect,
    });
  });

// 6) ============= Update service =============
export const updateService = async (id: string, data: UpdateServiceInput) =>
  prisma.$transaction(async (tx) => {
    const service = await getServiceForUpdateOrThrow(tx, id);

    // A closed service only accepts the external OS reference (it can be filled later).
    const onlyExternalOs = Object.keys(data).every((key) => key === "externalOsNumber");
    if (isClosed(service.status) && !onlyExternalOs) {
      throw new AppError("Serviço concluído ou cancelado não pode ser alterado", 409);
    }

    // The period is validated against the final values, not only the sent ones.
    const plannedStart = data.plannedStart === undefined ? service.plannedStart : data.plannedStart;
    const plannedEnd = data.plannedEnd === undefined ? service.plannedEnd : data.plannedEnd;
    if (plannedStart && plannedEnd && plannedEnd < plannedStart) {
      throw new AppError("O fim planejado deve ser posterior ou igual ao início planejado", 422);
    }

    return tx.service.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.externalOsNumber !== undefined && { externalOsNumber: data.externalOsNumber }),
        ...(data.plannedStart !== undefined && { plannedStart: data.plannedStart }),
        ...(data.plannedEnd !== undefined && { plannedEnd: data.plannedEnd }),
      },
      select: serviceDetailSelect,
    });
  });

// 7) ============= Update status =============
export const updateServiceStatus = async (id: string, status: ServiceStatusValue) =>
  prisma.$transaction(async (tx) => {
    const service = await getServiceForUpdateOrThrow(tx, id);

    const allowed = STATUS_TRANSITIONS[service.status as ServiceStatusValue] ?? [];
    if (!allowed.includes(status)) {
      throw new AppError(
        `Não é possível alterar o status de ${service.status} para ${status}`,
        409
      );
    }

    return tx.service.update({
      where: { id },
      data: { status, completedAt: status === "COMPLETED" ? new Date() : null },
      select: serviceDetailSelect,
    });
  });