import { z } from "zod";

export const revisionIdSchema = z.string().uuid("Identificador da revisão inválido");
const uuid = z.string().uuid("Identificador inválido");
export const revisionStatusSchema = z.enum(["PENDING", "SCHEDULED", "COMPLETED", "CANCELLED"]);
const scheduledAt = z.iso.datetime({ offset: true });
const notes = z.string().trim().max(10000).nullable().optional();

export const createRevisionSchema = z.strictObject({
  serviceId: uuid,
  visitId: uuid.nullable().optional(),
  scheduledAt,
  notes,
});

export const updateRevisionSchema = z.strictObject({
  visitId: uuid.nullable().optional(),
  scheduledAt: scheduledAt.optional(),
  notes,
  status: revisionStatusSchema.optional(),
}).refine((value) => Object.keys(value).length > 0, "Informe pelo menos um campo para atualizar");

export const listRevisionsSchema = z.strictObject({
  serviceId: uuid.optional(),
  clientId: uuid.optional(),
  status: revisionStatusSchema.optional(),
  from: scheduledAt.optional(),
  to: scheduledAt.optional(),
}).refine((value) => !value.from || !value.to || Date.parse(value.from) <= Date.parse(value.to), {
  path: ["to"],
  message: "O fim do período não pode ser anterior ao início",
});

export type CreateRevisionInput = z.infer<typeof createRevisionSchema>;
export type UpdateRevisionInput = z.infer<typeof updateRevisionSchema>;
export type ListRevisionsQuery = z.infer<typeof listRevisionsSchema>;
export type RevisionStatusValue = z.infer<typeof revisionStatusSchema>;
