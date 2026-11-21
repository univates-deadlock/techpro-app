import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import type {
  CreateWarrantyInput, ListWarrantiesQuery, UpdateWarrantyInput,
} from "../schemas/warranty.schema.js";
import { toWarrantyDate } from "../schemas/warranty.schema.js";
import { AppError } from "../utils/AppError.js";

const select = {
  id: true,
  serviceId: true,
  type: true,
  description: true,
  manufacturer: true,
  productReference: true,
  startsAt: true,
  endsAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  service: { select: { id: true, title: true, client: { select: { id: true, name: true } } } },
} satisfies Prisma.WarrantySelect;

type WarrantyDetails = {
  type: "SERVICE" | "MANUFACTURER";
  manufacturer?: string | null;
  productReference?: string | null;
  startsAt: Date;
  endsAt: Date;
};

function validateWarranty(value: WarrantyDetails) {
  if (value.endsAt < value.startsAt) {
    throw new AppError("A garantia não pode terminar antes do início", 400);
  }
  if (value.type === "SERVICE" && (value.manufacturer || value.productReference)) {
    throw new AppError("Dados de fabricante só podem ser informados em garantias de fabricante", 400);
  }
}

export const listWarranties = (filters: ListWarrantiesQuery) =>
  prisma.warranty.findMany({
    where: {
      serviceId: filters.serviceId,
      type: filters.type,
      endsAt: {
        gte: filters.from ? toWarrantyDate(filters.from) : undefined,
        lte: filters.to ? toWarrantyDate(filters.to) : undefined,
      },
    },
    select,
    orderBy: [{ endsAt: "asc" }, { id: "asc" }],
  });

export async function getWarranty(id: string) {
  const warranty = await prisma.warranty.findUnique({ where: { id }, select });
  if (!warranty) throw new AppError("Garantia não encontrada", 404);
  return warranty;
}

export async function createWarranty(input: CreateWarrantyInput) {
  const service = await prisma.service.findUnique({
    where: { id: input.serviceId },
    select: { id: true },
  });
  if (!service) throw new AppError("Serviço não encontrado", 404);

  const startsAt = toWarrantyDate(input.startsAt);
  const endsAt = toWarrantyDate(input.endsAt);
  validateWarranty({ ...input, startsAt, endsAt });

  return prisma.warranty.create({
    data: { ...input, startsAt, endsAt },
    select,
  });
}

export async function updateWarranty(id: string, input: UpdateWarrantyInput) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.warranty.findUnique({ where: { id } });
    if (!current) throw new AppError("Garantia não encontrada", 404);

    const startsAt = input.startsAt ? toWarrantyDate(input.startsAt) : current.startsAt;
    const endsAt = input.endsAt ? toWarrantyDate(input.endsAt) : current.endsAt;
    validateWarranty({
      type: input.type ?? current.type,
      manufacturer: input.manufacturer === undefined ? current.manufacturer : input.manufacturer,
      productReference: input.productReference === undefined ? current.productReference : input.productReference,
      startsAt,
      endsAt,
    });

    const updated = await tx.warranty.updateMany({
      where: { id, updatedAt: current.updatedAt },
      data: { ...input, startsAt, endsAt },
    });
    if (updated.count !== 1) throw new AppError("Garantia alterada por outro usuário", 409);
    return tx.warranty.findUniqueOrThrow({ where: { id }, select });
  });
}

export async function deleteWarranty(id: string) {
  const deleted = await prisma.warranty.deleteMany({ where: { id } });
  if (deleted.count === 0) throw new AppError("Garantia não encontrada", 404);
}
