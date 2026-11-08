/**
 * Frontend validation schemas, mirroring the API schemas.
 *
 * Validation gives users immediate feedback without a network request.
 * The server remains authoritative: the API validates all inputs again
 * using the schemas in `api/src/schemas/` (see RNF02).
 *
 * Zod is used instead of standalone regexes because the API also uses
 * `z.email()`, which checks rules such as dot placement, alphabetic TLDs,
 * and length limits. A permissive regex could accept addresses the API
 * rejects, leaving users waiting for a request before discovering the error.
 */
import { z } from "zod";

/**
 * Email field.
 *
 * Uses the same chain as `api/src/schemas/user.schema.ts`:
 * `trim().toLowerCase()` normalizes before validation, `max(254)` enforces the
 * RFC length limit, and `z.email()` checks the format.
 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "E-mail muito longo.")
  .pipe(z.email("Informe um e-mail válido."));

/** Login form. */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe a senha."),
});

/** Schema-derived type keeps the form aligned with validation. */
export type LoginInput = z.infer<typeof loginSchema>;

/* ==========================================================================
   Users — mirrors api/src/schemas/user.schema.ts
   ========================================================================== */

/** User creation form. */
export const userSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Informe o nome.")
    .max(200, "Máximo de 200 caracteres."),
  email: emailSchema,
  role: z.string().refine((v) => v === "ADMIN" || v === "PLANNING" || v === "TECHNICIAN", {
    message: "Selecione um perfil.",
  }),
  password: z
    .string()
    .min(8, "A senha deve ter pelo menos 8 caracteres.")
    .max(128, "Máximo de 128 caracteres."),
});

export type UserInput = z.infer<typeof userSchema>;

/** User edit form (no password — update is partial). */
export const userEditSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Informe o nome.")
    .max(200, "Máximo de 200 caracteres."),
  email: emailSchema,
  role: z.string().refine((v) => v === "ADMIN" || v === "PLANNING" || v === "TECHNICIAN", {
    message: "Selecione um perfil.",
  }),
});

export type UserEditInput = z.infer<typeof userEditSchema>;

/* ==========================================================================
   Clients — mirrors api/src/schemas/client.schema.ts
   ========================================================================== */

export const clientTypeSchema = z.enum(["INDIVIDUAL", "COMPANY"]);

const VALID_BR_DDDS = new Set([
  "11", "12", "13", "14", "15", "16", "17", "18", "19",
  "21", "22", "24", "27", "28",
  "31", "32", "33", "34", "35", "37", "38",
  "41", "42", "43", "44", "45", "46", "47", "48", "49",
  "51", "53", "54", "55",
  "61", "62", "63", "64", "65", "66", "67", "68", "69",
  "71", "73", "74", "75", "77", "79",
  "81", "82", "83", "84", "85", "86", "87", "88", "89",
  "91", "92", "93", "94", "95", "96", "97", "98", "99",
]);

const CNPJ_WEIGHTS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;
const CNPJ_WEIGHTS_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;

export function isValidCpf(digits: string): boolean {
  if (!/^\d{11}$/.test(digits)) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum1 = 0;
  for (let i = 0; i < 9; i++) {
    sum1 += Number(digits[i]) * (10 - i);
  }
  const check1 = ((sum1 * 10) % 11) % 10;
  if (check1 !== Number(digits[9])) return false;

  let sum2 = 0;
  for (let i = 0; i < 10; i++) {
    sum2 += Number(digits[i]) * (11 - i);
  }
  const check2 = ((sum2 * 10) % 11) % 10;
  return check2 === Number(digits[10]);
}

export function isValidCnpj(digits: string): boolean {
  if (!/^\d{14}$/.test(digits)) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  let sum1 = 0;
  for (let i = 0; i < 12; i++) {
    sum1 += Number(digits[i]) * CNPJ_WEIGHTS_1[i];
  }
  const rem1 = sum1 % 11;
  const check1 = rem1 < 2 ? 0 : 11 - rem1;
  if (check1 !== Number(digits[12])) return false;

  let sum2 = 0;
  for (let i = 0; i < 13; i++) {
    sum2 += Number(digits[i]) * CNPJ_WEIGHTS_2[i];
  }
  const rem2 = sum2 % 11;
  const check2 = rem2 < 2 ? 0 : 11 - rem2;
  return check2 === Number(digits[13]);
}

export function isValidBrazilianPhone(digits: string): boolean {
  if (!/^\d{10,11}$/.test(digits)) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  const ddd = digits.slice(0, 2);
  if (!VALID_BR_DDDS.has(ddd)) return false;

  const subscriber = digits.slice(2);
  if (/^0+$/.test(subscriber)) return false;

  if (subscriber.length === 9) {
    return subscriber[0] === "9" && subscriber[1] !== "0";
  }

  return /^[2-5]/.test(subscriber);
}

/**
 * Brazilian document: CPF (11 digits) for individuals, CNPJ (14) for companies,
 * validated with official modulo-11 check digits.
 */
export const documentSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d+$/.test(value), {
    message: "Informe apenas números.",
  })
  .refine((value) => value === "" || isValidCpf(value) || isValidCnpj(value), {
    message: "Informe um CPF ou CNPJ válido.",
  });

/** Optional landline (10 digits) or mobile (11 digits) with a valid Brazilian DDD. */
export const phoneSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d+$/.test(value), {
    message: "Informe apenas números.",
  })
  .refine((value) => value === "" || isValidBrazilianPhone(value), {
    message: "Informe um telefone válido com DDD.",
  });

const whatsappSchema = z
  .string()
  .trim()
  .min(1, "Informe o WhatsApp.")
  .refine((value) => /^\d+$/.test(value), {
    message: "Informe apenas números.",
  })
  .refine((value) => isValidBrazilianPhone(value), {
    message: "Informe um WhatsApp válido com DDD.",
  });

/**
 * Client form.
 *
 * Field limits and check digits match `api/src/schemas/client.schema.ts`.
 */
export const clientSchema = z
  .object({
    type: clientTypeSchema,
    name: z
      .string()
      .trim()
      .min(1, "Informe o nome do cliente.")
      .max(200, "Máximo de 200 caracteres."),
    document: z.string().trim(),
    contactName: z.string().trim().max(200, "Máximo de 200 caracteres."),
    phone: phoneSchema,
    whatsapp: whatsappSchema,
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(100, "Máximo de 100 caracteres.")
      .pipe(z.union([z.email("Informe um e-mail válido."), z.literal("")]))
      .transform((email) => (email === "" ? null : email))
      .nullable()
      .optional(),
    location: z
      .string()
      .trim()
      .min(1, "Informe o local de atendimento.")
      .max(100, "Máximo de 100 caracteres."),
    notes: z.string().trim(),
  })
  .superRefine((data, ctx) => {
    if (!data.document) return;
    if (data.type === "INDIVIDUAL" && !isValidCpf(data.document)) {
      ctx.addIssue({
        code: "custom",
        path: ["document"],
        message: "Informe um CPF válido.",
      });
    } else if (data.type === "COMPANY" && !isValidCnpj(data.document)) {
      ctx.addIssue({
        code: "custom",
        path: ["document"],
        message: "Informe um CNPJ válido.",
      });
    }
  });

export type ClientInput = z.infer<typeof clientSchema>;

/* ==========================================================================
   Quotes — mirrors api/src/schemas/quote.schema.ts
   ========================================================================== */

  export const quoteStatusSchema =  z.enum([
    "DRAFT", 
    "SENT", 
    "APPROVED", 
    "REJECTED", 
    "EXPIRED"
  ]);

  export const quoteItemTypeEnum = z.enum(["PRODUCT","SERVICE", 'OTHER']);

  const hasMaxTwoDecimals = (value: number) =>
    Math.abs(value * 100 - Math.round(value * 100)) <1e-6;

/**
 * Validates item entries inside a quote.
 */
export const quoteItemSchema = z.object({
  type: quoteItemTypeEnum,
  description: z
    .string()
    .trim()
    .min(1, "Informe a descrição do item."),
  quantity: z
    .number({error: "Informe uma quantidade válida."})
    .gt(0, "A quantidade inserida deve ser maior que zero.")
    .max(99_999_999.99, "Quantidade acima do limite permitido.")
    .refine(hasMaxTwoDecimals, "Quantidade deve ter no máximo 2 casas decimais."),
  unitPrice: z
    .number({ error: "Informe um valor unitário válido." })
    .min(0, "O valor unitário não pode ser negativo.")
    .max(9_999_999_999.99, "Valor unitário acima do limite permitido.")
    .refine(hasMaxTwoDecimals, "Valor unitário deve ter no máximo 2 casas decimais."),
  discount: z
    .number({ error: "Informe um desconto em reais (R$) válido." })
    .min(0, "O desconto do item em R$ não pode ser negativo.")
    .max(9_999_999_999.99, "Desconto acima do limite permitido.")
    .refine(hasMaxTwoDecimals, "Desconto deve ter no máximo 2 casas decimais.")
    .optional(),
});

/**
 * Quote creation and edit form (all monetary values and discounts are in R$).
 */
export const quoteSchema = z.object({
  clientId: z
    .string()
    .trim()
    .min(1, "Selecione um cliente.")
    .uuid("Identificador de cliente inválido."),
  notes: z.string().trim().nullable().optional(),
  discount: z
    .number({ error: "Informe um desconto geral em reais (R$) válido." })
    .min(0, "O desconto geral em R$ não pode ser negativo.")
    .max(9_999_999_999.99, "Desconto geral acima do limite permitido.")
    .refine(hasMaxTwoDecimals, "Desconto geral deve ter no máximo 2 casas decimais.")
    .optional(),
  items: z
    .array(quoteItemSchema)
    .min(1, "Adicione pelo menos 1 item ao orçamento.")
    .max(100, "O orçamento não pode ter mais de 100 itens."),
})

export type QuoteInput = z.infer<typeof quoteSchema>;

/** Approve decision: mirrors approveQuoteSchema in the API. */
export const approveQuoteSchema = z.object({
  decisionNotes: z.string().trim().nullable().optional(),
  decisionEvidenceUrl: z.string().trim().url("URL de evidência inválida.").nullable().optional(),
});

/** Reject decision: a reason is required, mirroring the API. */
export const rejectQuoteSchema = z.object({
  decisionNotes: z.string().trim().min(1, "Informe o motivo da rejeição."),
  decisionEvidenceUrl: z.string().trim().url("URL de evidência inválida.").nullable().optional(),
});

export type ApproveQuoteInput = z.infer<typeof approveQuoteSchema>;
export type RejectQuoteInput = z.infer<typeof rejectQuoteSchema>;