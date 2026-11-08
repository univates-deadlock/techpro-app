import { z } from "zod";

export const quoteStatusEnum = z.enum(["DRAFT", "SENT", "APPROVED", "REJECTED", "EXPIRED"]);
export const quoteItemTypeEnum = z.enum(["PRODUCT", "SERVICE", "OTHER"]);

export type QuoteStatusValue = z.infer<typeof quoteStatusEnum>;

export const MAX_QUOTE_ITEMS = 100;

// ============= Number helpers =============
const hasMaxTwoDecimals = (value: number) =>
  Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;

const money = (label: string) =>
  z
    .number({ error: `${label} inválido` })
    .min(0, `${label} não pode ser negativo`)
    .max(9_999_999_999.99, `${label} acima do limite permitido`)
    .refine(hasMaxTwoDecimals, `${label} deve ter no máximo 2 casas decimais`);

const quantity = z
  .number({ error: "Quantidade inválida" })
  .gt(0, "A quantidade deve ser maior que zero")
  .max(99_999_999.99, "Quantidade acima do limite permitido")
  .refine(hasMaxTwoDecimals, "Quantidade deve ter no máximo 2 casas decimais");

// ============= Items =============
const quoteItemFields = {
  type: quoteItemTypeEnum,
  description: z.string().trim().min(1, "Informe a descrição do item"),
  quantity,
  unitPrice: money("Valor unitário"),
  discount: money("Desconto do item").optional(), // In R$; defaults to 0 when omitted.
};

export const createQuoteItemSchema = z.strictObject(quoteItemFields);

export const updateQuoteItemSchema = z
  .strictObject(quoteItemFields)
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: "Informe pelo menos um campo para atualizar" }
  );

// ============= Quote =============
export const quoteIdSchema = z.string().trim().uuid("Identificador do orçamento inválido");
export const quoteItemIdSchema = z.string().trim().uuid("Identificador do item inválido");

export const syncQuoteItemSchema = z.strictObject({
  id: quoteItemIdSchema.optional(),
  ...quoteItemFields,
});

export const createQuoteSchema = z.strictObject({
  clientId: z.string().trim().uuid("Identificador do cliente inválido"),
  notes: z.string().trim().nullable().optional(),
  discount: money("Desconto geral").optional(), // Overall discount in R$; defaults to 0 when omitted.
  items: z.array(createQuoteItemSchema).max(MAX_QUOTE_ITEMS, "Máximo de 100 itens por orçamento").optional(),
});

export const updateQuoteSchema = z
  .strictObject({
    notes: z.string().trim().nullable().optional(),
    discount: money("Desconto geral").optional(),
    items: z
      .array(syncQuoteItemSchema)
      .max(MAX_QUOTE_ITEMS, "Máximo de 100 itens por orçamento")
      .optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: "Informe pelo menos um campo para atualizar" }
  );

export const listQuotesQuerySchema = z.object({
  clientId: z.string().trim().uuid("Identificador do cliente inválido").optional(),
  status: quoteStatusEnum.optional(),
});

export const rejectQuoteSchema = z.strictObject({
  decisionNotes: z.string().trim().min(1, "Informe o motivo da rejeição"),
  decisionEvidenceUrl: z.string().trim().url("URL de evidência inválida").nullable().optional(),
});

export const approveQuoteSchema = z.strictObject({
  decisionNotes: z.string().trim().nullable().optional(),
  decisionEvidenceUrl: z.string().trim().url("URL de evidência inválida").nullable().optional(),
});


export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;
export type CreateQuoteItemInput = z.infer<typeof createQuoteItemSchema>;
export type UpdateQuoteItemInput = z.infer<typeof updateQuoteItemSchema>;
export type ListQuotesQuery = z.infer<typeof listQuotesQuerySchema>;
export type RejectQuoteInput = z.infer<typeof rejectQuoteSchema>;
export type ApproveQuoteInput = z.infer<typeof approveQuoteSchema>;