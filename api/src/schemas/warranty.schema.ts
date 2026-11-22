import { z } from "zod";

export const warrantyIdSchema = z.string().uuid("Identificador da garantia inválido");
const serviceId = z.string().uuid("Identificador do serviço inválido");

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data no formato AAAA-MM-DD")
  .refine((value) => {
    const date = new Date(value + "T00:00:00.000Z");
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Data inválida");

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

const writableFields = {
  type: z.enum(["SERVICE", "MANUFACTURER"]),
  description: optionalText(5000),
  manufacturer: optionalText(150),
  productReference: optionalText(200),
  startsAt: dateOnly,
  endsAt: dateOnly,
  notes: optionalText(10000),
};

export const createWarrantySchema = z.strictObject({
  serviceId,
  ...writableFields,
}).refine((value) => value.endsAt >= value.startsAt, {
  path: ["endsAt"],
  message: "A garantia não pode terminar antes do início",
});

export const updateWarrantySchema = z.strictObject(writableFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Informe pelo menos um campo para atualizar");

export const listWarrantiesSchema = z.strictObject({
  serviceId: serviceId.optional(),
  type: writableFields.type.optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
}).refine((value) => !value.from || !value.to || value.from <= value.to, {
  path: ["to"],
  message: "O fim do período não pode ser anterior ao início",
});

export type CreateWarrantyInput = z.infer<typeof createWarrantySchema>;
export type UpdateWarrantyInput = z.infer<typeof updateWarrantySchema>;
export type ListWarrantiesQuery = z.infer<typeof listWarrantiesSchema>;
export const toWarrantyDate = (value: string): Date => new Date(value + "T00:00:00.000Z");
