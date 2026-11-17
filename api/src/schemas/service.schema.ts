import { z } from "zod";

export const serviceOriginEnum = z.enum(
  ["QUOTE", "SUPPORT", "MAINTENANCE", "REVISION", "WARRANTY", "OTHER"],
  { error: "Origem do serviço inválida" }
);

// The Prisma column is a free string (the requirements don't list statuses),
// so these are the only values the API accepts.
export const serviceStatusEnum = z.enum(
  ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
  { error: "Status do serviço inválido" }
);

export type ServiceOriginValue = z.infer<typeof serviceOriginEnum>;
export type ServiceStatusValue = z.infer<typeof serviceStatusEnum>;

// ============= Helpers =============
const dateTime = (label: string) =>
  z.iso
    .datetime({ offset: true, error: `${label}: use data e hora no formato ISO 8601` })
    .transform((value) => new Date(value));

const validatePeriod = (
  data: { plannedStart?: Date | null; plannedEnd?: Date | null },
  ctx: z.RefinementCtx
) => {
  if (data.plannedStart && data.plannedEnd && data.plannedEnd < data.plannedStart) {
    ctx.addIssue({
      code: "custom",
      path: ["plannedEnd"],
      message: "O fim planejado deve ser posterior ou igual ao início planejado",
    });
  }
};

// ============= Service =============
export const serviceIdSchema = z.string().trim().uuid("Identificador do serviço inválido");

// Fields that can be edited after the service is created.
const editableFields = {
  title: z.string().trim().min(1, "Informe o título do serviço").max(200),
  description: z.string().trim().nullable().optional(),
  // External OS is only a manual reference (RN-SRV-02); an empty string clears it.
  externalOsNumber: z
    .string()
    .trim()
    .max(100, "Número da OS muito longo")
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional(),
  plannedStart: dateTime("Início planejado").nullable().optional(),
  plannedEnd: dateTime("Fim planejado").nullable().optional(),
};

export const createServiceSchema = z
  .strictObject({
    clientId: z.string().trim().uuid("Identificador do cliente inválido").optional(),
    quoteId: z.string().trim().uuid("Identificador do orçamento inválido").optional(),
    origin: serviceOriginEnum,
    ...editableFields,
  })
  .superRefine((data, ctx) => {
    validatePeriod(data, ctx);

    // RN-SRV-01: a quote is mandatory when origin = QUOTE.
    if (data.origin === "QUOTE" && !data.quoteId) {
      ctx.addIssue({
        code: "custom",
        path: ["quoteId"],
        message: "Informe o orçamento aprovado para serviços de origem QUOTE",
      });
    }

    if (data.origin !== "QUOTE" && data.quoteId) {
      ctx.addIssue({
        code: "custom",
        path: ["quoteId"],
        message: "Só é possível vincular orçamento a serviços de origem QUOTE",
      });
    }

    // With a quote, the client comes from the quote.
    if (!data.quoteId && !data.clientId) {
      ctx.addIssue({
        code: "custom",
        path: ["clientId"],
        message: "Informe o cliente",
      });
    }
  });

export const updateServiceSchema = z
  .strictObject(editableFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Informe pelo menos um campo para atualizar",
  })
  .superRefine(validatePeriod);

export const updateServiceStatusSchema = z.strictObject({ status: serviceStatusEnum });

export const listServicesQuerySchema = z
  .object({
    clientId: z.string().trim().uuid("Identificador do cliente inválido").optional(),
    status: serviceStatusEnum.optional(),
    origin: serviceOriginEnum.optional(),
    // Free text: matches title, external OS number or client name.
    q: z.string().trim().min(1).max(100).optional(),
    // Planned start range (RF23).
    from: z.coerce.date({ error: "Data inicial inválida" }).optional(),
    to: z.coerce.date({ error: "Data final inválida" }).optional(),
  })
  .refine((data) => !data.from || !data.to || data.from <= data.to, {
    path: ["to"],
    message: "A data final deve ser posterior ou igual à data inicial",
  });

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
export type ListServicesQuery = z.infer<typeof listServicesQuerySchema>;