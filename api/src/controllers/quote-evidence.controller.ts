import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { quoteIdSchema } from "../schemas/quote.schema.js";
import {
  deleteEvidenceObject,
  putEvidenceObject,
  readEvidenceObject,
} from "../services/quote-evidence.storage.js";
import { AppError } from "../utils/AppError.js";
import { evidenceDownloadUrl } from "../utils/quoteEvidenceUrl.js";
import { isValidEvidenceContent } from "../utils/evidenceValidation.js";

const formats = {
  "application/pdf": { extension: "pdf" },
  "image/png": { extension: "png" },
  "image/jpeg": { extension: "jpg" },
} as const;
type EvidenceMime = keyof typeof formats;
const typesByExtension: Record<string, EvidenceMime> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
};
const storedName = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|png|jpg)$/;

const objectKey = (quoteId: string, filename: string) => "quotes/" + quoteId + "/" + filename;
async function getQuote(id: string) {
  const quote = await prisma.quote.findUnique({
    where: { id },
    select: { status: true, decisionEvidenceUrl: true },
  });
  if (!quote) throw new AppError("Orçamento não encontrado", 404);
  return quote;
}

export const upload = async (req: Request, res: Response) => {
  const id = quoteIdSchema.parse(req.params.id);
  const contentType = (req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(formats, contentType)) {
    throw new AppError("Formato não aceito. Envie PDF, PNG ou JPEG", 415);
  }
  const format = formats[contentType as EvidenceMime];
  const bytes: unknown = req.body;
  if (!isValidEvidenceContent(bytes, contentType as EvidenceMime)) {
    throw new AppError("Arquivo inválido ou maior que 10 MiB", 400);
  }

  const quote = await getQuote(id);
  if (quote.status !== "APPROVED") {
    throw new AppError("Somente orçamentos aprovados podem receber evidências", 409);
  }
  if (quote.decisionEvidenceUrl) {
    throw new AppError("Este orçamento já possui uma evidência", 409);
  }

  const filename = randomUUID() + "." + format.extension;
  const key = objectKey(id, filename);
  await putEvidenceObject(key, bytes, contentType);

  try {
    const updated = await prisma.quote.updateMany({
      where: { id, status: "APPROVED", decisionEvidenceUrl: null },
      data: { decisionEvidenceUrl: key },
    });
    if (updated.count !== 1) throw new AppError("A evidência já foi alterada", 409);
  } catch (error) {
    // The upload is not committed if the DB link could not be saved.
    try {
      await deleteEvidenceObject(key);
    } catch {
      console.error("[EVIDENCE_STORAGE]: Failed to clean up orphaned object");
    }
    throw error;
  }

  return res.status(201).json({ url: evidenceDownloadUrl(id, key) });
};

export const download = async (req: Request, res: Response) => {
  const id = quoteIdSchema.parse(req.params.id);
  const filename = req.params.filename;
  if (typeof filename !== "string" || !storedName.test(filename)) {
    throw new AppError("Evidência não encontrada", 404);
  }
  const quote = await getQuote(id);
  const key = objectKey(id, filename);
  if (quote.decisionEvidenceUrl !== key) {
    throw new AppError("Evidência não encontrada", 404);
  }

  const file = await readEvidenceObject(key);
  const extension = filename.split(".").pop() ?? "";
  return res
    .type(typesByExtension[extension])
    .set("Cache-Control", "private, no-store")
    .set("X-Content-Type-Options", "nosniff")
    .send(file);
};
