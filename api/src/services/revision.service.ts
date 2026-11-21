import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import type {
  CreateRevisionInput, ListRevisionsQuery, RevisionStatusValue, UpdateRevisionInput,
} from "../schemas/revision.schema.js";
import { AppError } from "../utils/AppError.js";

const select = {
  id: true,
  serviceId: true,
  visitId: true,
  scheduledAt: true,
  status: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  service: { select: { id: true, title: true, client: { select: { id: true, name: true } } } },
} satisfies Prisma.RevisionSelect;

const transitions: Record<RevisionStatusValue, readonly RevisionStatusValue[]> = {
  PENDING: ["SCHEDULED", "COMPLETED", "CANCELLED"],
  SCHEDULED: ["PENDING", "COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

async function assertVisitBelongsToService(
  tx: Pick<typeof prisma, "serviceVisit">,
  visitId: string | null | undefined,
  serviceId: string,
) {
  if (!visitId) return;
  const visit = await tx.serviceVisit.findUnique({
    where: { id: visitId },
    select: { serviceId: true },
  });
  if (!visit) throw new AppError("Visita não encontrada", 404);
  if (visit.serviceId !== serviceId) {
    throw new AppError("A visita informada pertence a outro serviço", 409);
  }
}

export const listRevisions = (filters: ListRevisionsQuery) =>
  prisma.revision.findMany({
    where: {
      serviceId: filters.serviceId,
      service: filters.clientId ? { clientId: filters.clientId } : undefined,
      status: filters.status,
      scheduledAt: {
        gte: filters.from ? new Date(filters.from) : undefined,
        lte: filters.to ? new Date(filters.to) : undefined,
      },
    },
    select,
    orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
  });

export async function getRevision(id: string) {
  const revision = await prisma.revision.findUnique({ where: { id }, select });
  if (!revision) throw new AppError("Revisão não encontrada", 404);
  return revision;
}

export async function createRevision(input: CreateRevisionInput) {
  const service = await prisma.service.findUnique({
    where: { id: input.serviceId },
    select: { id: true },
  });
  if (!service) throw new AppError("Serviço não encontrado", 404);
  await assertVisitBelongsToService(prisma, input.visitId, input.serviceId);

  return prisma.revision.create({
    data: {
      serviceId: input.serviceId,
      scheduledAt: new Date(input.scheduledAt),
      notes: input.notes,
      visitId: input.visitId,
      status: "PENDING",
    },
    select,
  });
}

export async function updateRevision(id: string, input: UpdateRevisionInput) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.revision.findUnique({ where: { id } });
    if (!current) throw new AppError("Revisão não encontrada", 404);

    const nextStatus = input.status ?? current.status;
    if (nextStatus !== current.status && !transitions[current.status].includes(nextStatus)) {
      throw new AppError("Transição de status da revisão não permitida", 409);
    }
    if ((current.status === "COMPLETED" || current.status === "CANCELLED") &&
        Object.keys(input).some((key) => key !== "status")) {
      throw new AppError("Revisões concluídas ou canceladas não podem ser alteradas", 409);
    }

    await assertVisitBelongsToService(tx, input.visitId, current.serviceId);
    const updated = await tx.revision.updateMany({
      where: { id, updatedAt: current.updatedAt, status: current.status },
      data: {
        ...input,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
      },
    });
    if (updated.count !== 1) throw new AppError("Revisão alterada por outro usuário", 409);
    return tx.revision.findUniqueOrThrow({ where: { id }, select });
  });
}

export async function deleteRevision(id: string) {
  const deleted = await prisma.revision.deleteMany({ where: { id, status: "PENDING" } });
  if (deleted.count === 1) return;
  const exists = await prisma.revision.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new AppError("Revisão não encontrada", 404);
  throw new AppError("Apenas revisões pendentes podem ser excluídas", 409);
}
