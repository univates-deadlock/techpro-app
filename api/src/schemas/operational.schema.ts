import { z } from "zod";

export const operationalQuerySchema = z.strictObject({
  days: z.coerce.number().int().min(1).max(90).default(14),
});
