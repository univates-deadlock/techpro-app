import { z } from "zod";

// The Prisma column is a free string (the requirements don't list visit statuses),
// so these are the only values the API accepts. Mirrors the service statuses.
export const visitStatusEnum = z.enum(
  ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
  { error: "Status da visita inválido" }
);

export type VisitStatusValue = z.infer<typeof visitStatusEnum>;

// The PRD mentions two fixed technicians plus one occasional; 10 is a generous cap.
export const MAX_VISIT_TECHNICIANS = 10;

// ============= Helpers =============
const dateTime = (label: string) =>
  z.iso
    .datetime({ offset: true, error: `${label}: use data e hora no formato ISO 8601` })
    .transform((value) => new Date(value));

const validateSchedule = (
  data: { scheduledStart?: Date; scheduledEnd?: Date | null },
  ctx: z.RefinementCtx
) => {
  if (data.scheduledStart && data.scheduledEnd && data.scheduledEnd < data.scheduledStart) {
    ctx.addIssue({
      code: "custom",
      path: ["scheduledEnd"],
      message: "O fim agendado deve ser posterior ou igual ao início agendado",
    });
  }
};

// ============= Visit =============
export const visitIdSchema = z.string().trim().uuid("Identificador da visita inválido");

// Technicians are users, whose ids are Better Auth strings (not necessarily UUIDs).
const technicianIdSchema = z
  .string()
  .trim()
  .min(1, "Identificador do técnico inválido")
  .max(128, "Identificador do técnico inválido");

// Duplicated ids are collapsed instead of rejected.
const technicianIdsSchema = z
  .array(technicianIdSchema, { error: "Informe a lista de técnicos (technicianIds)" })
  .max(MAX_VISIT_TECHNICIANS, `Uma visita aceita no máximo ${MAX_VISIT_TECHNICIANS} técnicos`)
  .transform((ids) => [...new Set(ids)]);

// Explicit confirmation to schedule even when a technician has a time conflict.
const confirmConflicts = z.boolean({ error: "confirmConflicts deve ser true ou false" }).optional();

// Fields the planner can set while the visit is still SCHEDULED (RF14).
// The location is the client's (the visit has no location of its own).
// Actual start/end and status are handled by the execution endpoints (RF17).
const editableFields = {
  scheduledStart: dateTime("Início agendado"),
  scheduledEnd: dateTime("Fim agendado").nullable().optional(),
  description: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
};

export const createVisitSchema = z
  .strictObject({
    ...editableFields,
    technicianIds: technicianIdsSchema.optional(),
    confirmConflicts,
  })
  .superRefine(validateSchedule);

export const updateVisitSchema = z
  .strictObject({ ...editableFields, confirmConflicts })
  .partial()
  // confirmConflicts alone changes nothing, so it doesn't count as a field to update.
  .refine((data) => Object.keys(data).some((key) => key !== "confirmConflicts"), {
    message: "Informe pelo menos um campo para atualizar",
  })
  .superRefine(validateSchedule);

// Replaces the whole technician list of a visit (an empty list removes everyone).
export const setVisitTechniciansSchema = z.strictObject({
  technicianIds: technicianIdsSchema,
  confirmConflicts,
});

export const listVisitsQuerySchema = z
  .object({
    serviceId: z.string().trim().uuid("Identificador do serviço inválido").optional(),
    technicianId: technicianIdSchema.optional(),
    status: visitStatusEnum.optional(),
    // Scheduled start range.
    from: z.coerce.date({ error: "Data inicial inválida" }).optional(),
    to: z.coerce.date({ error: "Data final inválida" }).optional(),
  })
  .refine((data) => !data.from || !data.to || data.from <= data.to, {
    path: ["to"],
    message: "A data final deve ser posterior ou igual à data inicial",
  });

export type CreateVisitInput = z.infer<typeof createVisitSchema>;
export type UpdateVisitInput = z.infer<typeof updateVisitSchema>;
export type SetVisitTechniciansInput = z.infer<typeof setVisitTechniciansSchema>;
export type ListVisitsQuery = z.infer<typeof listVisitsQuerySchema>;