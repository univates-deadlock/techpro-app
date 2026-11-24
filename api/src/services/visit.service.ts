import { prisma } from "../lib/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import type {
  CreateVisitInput,
  ListVisitsQuery,
  SetVisitTechniciansInput,
  UpdateVisitInput,
} from "../schemas/visit.schema.js";
import { AppError } from "../utils/AppError.js";

// 1) ============= Selects =============
export const visitSelect = {
  id: true,
  serviceId: true,
  scheduledStart: true,
  scheduledEnd: true,
  actualStart: true,
  actualEnd: true,
  status: true,
  description: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  // The schema has no location on the visit: the location is the client's.
  service: {
    select: {
      id: true,
      title: true,
      status: true,
      client: { select: { id: true, name: true, location: true } },
    },
  },
  technicians: { select: { technician: { select: { id: true, name: true } } } },
} satisfies Prisma.ServiceVisitSelect;

type VisitPayload = Prisma.ServiceVisitGetPayload<{ select: typeof visitSelect }>;

// 2) ============= Conflict types =============
export type VisitConflict = {
  technician: { id: string; name: string };
  visit: {
    id: string;
    serviceId: string;
    serviceTitle: string;
    scheduledStart: Date;
    scheduledEnd: Date | null;
  };
};

// Writes that touch technicians either succeed or report the conflicts found
// (nothing is saved in that case; the client must confirm explicitly).
export type VisitWriteResult =
  | { ok: true; visit: VisitPayload }
  | { ok: false; conflicts: VisitConflict[] };

// 3) ============= Internal helpers =============
// A visit without scheduledEnd is treated as lasting this long when checking conflicts.
export const DEFAULT_VISIT_DURATION_MS = 2 * 60 * 60 * 1000;

const isClosed = (status: string) => status === "COMPLETED" || status === "CANCELLED";

// Locks the visit row and ensures it exists (same pattern used for services).
const getVisitForUpdateOrThrow = async (tx: Prisma.TransactionClient, id: string) => {
  await tx.$queryRaw`SELECT "id" FROM "service_visit" WHERE "id" = ${id}::uuid FOR UPDATE`;

  const visit = await tx.serviceVisit.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      scheduledStart: true,
      scheduledEnd: true,
      technicians: { select: { technicianId: true } },
    },
  });

  if (!visit) {
    throw new AppError("Visita não encontrada", 404);
  }

  return visit;
};

// Only active TECHNICIAN users can be assigned. The rows are locked (always in id
// order, to avoid deadlocks) so two planners can't assign the same technician to
// overlapping visits at the same time and both pass the conflict check.
const lockAndValidateTechnicians = async (tx: Prisma.TransactionClient, technicianIds: string[]) => {
  await tx.$queryRaw`SELECT "id" FROM "user" WHERE "id" IN (${Prisma.join(technicianIds)}) ORDER BY "id" FOR UPDATE`;

  const users = await tx.user.findMany({
    where: { id: { in: technicianIds } },
    select: { id: true, role: true, isActive: true },
  });

  const valid = new Set(
    users.filter((user) => user.role === "TECHNICIAN" && user.isActive).map((user) => user.id)
  );
  const invalid = technicianIds.filter((id) => !valid.has(id));

  if (invalid.length > 0) {
    throw new AppError(
      `Só é possível atribuir técnicos ativos. Inválidos: ${invalid.join(", ")}`,
      422
    );
  }
};

// Finds other (non-cancelled) visits of the given technicians that overlap the window.
// Ranges are half-open: a visit starting exactly when another ends is not a conflict.
const findConflicts = async (
  tx: Prisma.TransactionClient,
  params: { technicianIds: string[]; start: Date; end: Date | null; ignoreVisitId?: string }
): Promise<VisitConflict[]> => {
  const { technicianIds, start, end, ignoreVisitId } = params;

  if (technicianIds.length === 0) {
    return [];
  }

  const windowEnd = end ?? new Date(start.getTime() + DEFAULT_VISIT_DURATION_MS);

  const overlapping = await tx.serviceVisit.findMany({
    where: {
      ...(ignoreVisitId && { id: { not: ignoreVisitId } }),
      status: { not: "CANCELLED" },
      scheduledStart: { lt: windowEnd },
      OR: [
        { scheduledEnd: { gt: start } },
        // No end: the visit is assumed to last the default duration.
        {
          scheduledEnd: null,
          scheduledStart: { gt: new Date(start.getTime() - DEFAULT_VISIT_DURATION_MS) },
        },
      ],
      technicians: { some: { technicianId: { in: technicianIds } } },
    },
    select: {
      id: true,
      serviceId: true,
      scheduledStart: true,
      scheduledEnd: true,
      service: { select: { title: true } },
      technicians: {
        where: { technicianId: { in: technicianIds } },
        select: { technician: { select: { id: true, name: true } } },
      },
    },
    orderBy: [{ scheduledStart: "asc" }, { id: "asc" }],
  });

  return overlapping.flatMap((visit) =>
    visit.technicians.map(({ technician }) => ({
      technician,
      visit: {
        id: visit.id,
        serviceId: visit.serviceId,
        serviceTitle: visit.service.title,
        scheduledStart: visit.scheduledStart,
        scheduledEnd: visit.scheduledEnd,
      },
    }))
  );
};

// 4) ============= Create visit (RF14, RF15) =============
// The visit and its technicians are saved in the same transaction.
export const createVisit = async (
  serviceId: string,
  data: CreateVisitInput
): Promise<VisitWriteResult> =>
  prisma.$transaction(async (tx): Promise<VisitWriteResult> => {
    // Lock the service so it can't be closed while the visit is being created.
    await tx.$queryRaw`SELECT "id" FROM "service" WHERE "id" = ${serviceId}::uuid FOR UPDATE`;

    const service = await tx.service.findUnique({
      where: { id: serviceId },
      select: { id: true, status: true },
    });

    if (!service) {
      throw new AppError("Serviço não encontrado", 404);
    }

    if (isClosed(service.status)) {
      throw new AppError("Não é possível agendar visita em serviço concluído ou cancelado", 409);
    }

    const technicianIds = data.technicianIds ?? [];

    if (technicianIds.length > 0) {
      await lockAndValidateTechnicians(tx, technicianIds);

      if (!data.confirmConflicts) {
        const conflicts = await findConflicts(tx, {
          technicianIds,
          start: data.scheduledStart,
          end: data.scheduledEnd ?? null,
        });

        if (conflicts.length > 0) {
          return { ok: false, conflicts };
        }
      }
    }

    const visit = await tx.serviceVisit.create({
      data: {
        serviceId,
        scheduledStart: data.scheduledStart,
        scheduledEnd: data.scheduledEnd ?? null,
        status: "SCHEDULED",
        description: data.description ?? null,
        notes: data.notes ?? null,
        ...(technicianIds.length > 0 && {
          technicians: { create: technicianIds.map((technicianId) => ({ technicianId })) },
        }),
      },
      select: visitSelect,
    });

    return { ok: true, visit };
  });

// 5) ============= List visits (filters: period, status, service, technician) =============
export const getAllVisits = async (filters: ListVisitsQuery) =>
  prisma.serviceVisit.findMany({
    where: {
      ...(filters.serviceId && { serviceId: filters.serviceId }),
      ...(filters.status && { status: filters.status }),
      ...(filters.technicianId && {
        technicians: { some: { technicianId: filters.technicianId } },
      }),
      ...((filters.from || filters.to) && {
        scheduledStart: {
          ...(filters.from && { gte: filters.from }),
          ...(filters.to && { lte: filters.to }),
        },
      }),
    },
    select: visitSelect,
    orderBy: [{ scheduledStart: "asc" }, { id: "asc" }],
  });

// 6) ============= List visits of a service =============
export const getVisitsByService = async (serviceId: string) => {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: { id: true },
  });

  if (!service) {
    throw new AppError("Serviço não encontrado", 404);
  }

  return prisma.serviceVisit.findMany({
    where: { serviceId },
    select: visitSelect,
    orderBy: [{ scheduledStart: "asc" }, { id: "asc" }],
  });
};

// 7) ============= Search visit by ID =============
export const getVisitById = async (id: string) => {
  const visit = await prisma.serviceVisit.findUnique({ where: { id }, select: visitSelect });

  if (!visit) {
    throw new AppError("Visita não encontrada", 404);
  }

  return visit;
};

// 8) ============= Update / reschedule visit =============
// When the time changes and the visit already has technicians, their schedules are
// checked again against the new window.
export const updateVisit = async (id: string, data: UpdateVisitInput): Promise<VisitWriteResult> =>
  prisma.$transaction(async (tx): Promise<VisitWriteResult> => {
    const visit = await getVisitForUpdateOrThrow(tx, id);

    if (visit.status !== "SCHEDULED") {
      throw new AppError("Só é possível alterar visitas com status agendado", 409);
    }

    // The period is validated against the final values, not only the sent ones.
    const scheduledStart = data.scheduledStart ?? visit.scheduledStart;
    const scheduledEnd = data.scheduledEnd === undefined ? visit.scheduledEnd : data.scheduledEnd;
    if (scheduledEnd && scheduledEnd < scheduledStart) {
      throw new AppError("O fim agendado deve ser posterior ou igual ao início agendado", 422);
    }

    const timeChanged = data.scheduledStart !== undefined || data.scheduledEnd !== undefined;
    const technicianIds = visit.technicians.map((item) => item.technicianId);

    if (timeChanged && !data.confirmConflicts && technicianIds.length > 0) {
      await lockAndValidateTechnicians(tx, technicianIds);

      const conflicts = await findConflicts(tx, {
        technicianIds,
        start: scheduledStart,
        end: scheduledEnd,
        ignoreVisitId: id,
      });

      if (conflicts.length > 0) {
        return { ok: false, conflicts };
      }
    }

    const updated = await tx.serviceVisit.update({
      where: { id },
      data: {
        ...(data.scheduledStart !== undefined && { scheduledStart: data.scheduledStart }),
        ...(data.scheduledEnd !== undefined && { scheduledEnd: data.scheduledEnd }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
      select: visitSelect,
    });

    return { ok: true, visit: updated };
  });

// 9) ============= Assign / unassign technicians (RF15) =============
// Replaces the whole list in one transaction: technicians missing from the list are
// removed and new ones are added. Conflicts are checked only for the added ones.
export const setVisitTechnicians = async (
  id: string,
  data: SetVisitTechniciansInput
): Promise<VisitWriteResult> =>
  prisma.$transaction(async (tx): Promise<VisitWriteResult> => {
    const visit = await getVisitForUpdateOrThrow(tx, id);

    if (visit.status !== "SCHEDULED") {
      throw new AppError("Só é possível alterar técnicos de visitas com status agendado", 409);
    }

    const { technicianIds } = data;

    if (technicianIds.length > 0) {
      await lockAndValidateTechnicians(tx, technicianIds);

      const current = new Set(visit.technicians.map((item) => item.technicianId));
      const added = technicianIds.filter((technicianId) => !current.has(technicianId));

      if (added.length > 0 && !data.confirmConflicts) {
        const conflicts = await findConflicts(tx, {
          technicianIds: added,
          start: visit.scheduledStart,
          end: visit.scheduledEnd,
          ignoreVisitId: id,
        });

        if (conflicts.length > 0) {
          return { ok: false, conflicts };
        }
      }
    }

    await tx.visitTechnician.deleteMany({
      where: { visitId: id, technicianId: { notIn: technicianIds } },
    });

    if (technicianIds.length > 0) {
      await tx.visitTechnician.createMany({
        data: technicianIds.map((technicianId) => ({ visitId: id, technicianId })),
        skipDuplicates: true,
      });
    }

    const updated = await tx.serviceVisit.findUniqueOrThrow({ where: { id }, select: visitSelect });

    return { ok: true, visit: updated };
  });