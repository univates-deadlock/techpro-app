import "dotenv/config";
import { z } from "zod";

const httpUrl = z.url().refine((value) => ["http:", "https:"].includes(new URL(value).protocol));
const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: httpUrl.default("http://localhost:4000"),
  FE_BASE_URL: httpUrl.default("http://localhost:3000"),
  EVIDENCE_DIR: z.string().min(1).default("./evidence"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const fields = [...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))];
  throw new Error(`Configuração inválida: ${fields.join(", ")}. Consulte api/.env.example.`);
}

export const env = parsed.data;
