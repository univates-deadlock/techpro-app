import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { quoteIdSchema } from "../schemas/quote.schema.js";
import { AppError } from "../utils/AppError.js";

const acceptedFormats = {
  "application/pdf": {
    extension: "pdf",
    signature: Buffer.from("%PDF-"),
  },
  "image/png": {
    extension: "png",
    signature: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  "image/jpeg": {
    extension: "jpg",
    signature: Buffer.from([0xff, 0xd8, 0xff]),
  },
} as const;
type EvidenceMime = keyof typeof acceptedFormats;
const mimeByExtension: Record<string, EvidenceMime> = {
  pdf: "application/pdf", png: "image/png", jpg: "image/jpeg",
};

const storedName = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|png|jpg)$/;

async function getQuote(id: string) {
  const quote = await prisma.quote.findUnique({
    where: { id },
    select: { id: true, status: true, decisionEvidenceUrl: true },
  });
  if (!quote) throw new AppError("Orçamento não encontrado", 404);
  return quote;
}

/** Raw binary upload avoids multipart dependencies and client-controlled file paths. */
export const upload = async (req: Request, res: Response) => {
  const id = quoteIdSchema.parse(req.params.id);
  const contentType = (req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
  if (!(contentType in acceptedFormats)) {
    throw new AppError("Formato não aceito. Envie PDF, PNG ou JPEG", 415);
  }
  const format = acceptedFormats[contentType as EvidenceMime];
  const bytes: unknown = req.body;
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 ||
      bytes.length > 10 * 1024 * 1024 ||
      !bytes.subarray(0, format.signature.length).equals(format.signature)) {
    throw new AppError("Arquivo inválido ou maior que 10 MB", 400);
  }

  const quote = await getQuote(id);
  if (quote.status !== "APPROVED") {
    throw new AppError("Somente orçamentos aprovados podem receber evidências", 409);
  }
  if (quote.decisionEvidenceUrl) {
    throw new AppError("Este orçamento já possui uma evidência", 409);
  }

  const filename = randomUUID() + "." + format.extension;
  const path = join(env.EVIDENCE_DIR, filename);
  const url = "/api/quotes/" + id + "/evidence/" + filename;
  await mkdir(env.EVIDENCE_DIR, { recursive: true, mode: 0o700 });
  await writeFile(path, bytes, { flag: "wx", mode: 0o600 });

  try {
    // Compare-and-set prevents concurrent uploads from overwriting evidence.
    const updated = await prisma.quote.updateMany({
      where: { id, status: "APPROVED", decisionEvidenceUrl: null },
      data: { decisionEvidenceUrl: url },
    });
    if (updated.count !== 1) throw new AppError("A evidência já foi alterada", 409);
  } catch (error) {
    await unlink(path).catch(() => undefined);
    throw error;
  }

  return res.status(201).json({ url });
};

export const download = async (req: Request, res: Response) => {
  const id = quoteIdSchema.parse(req.params.id);
  const filename = req.params.filename;
  if (typeof filename !== "string" || !storedName.test(filename)) {
    throw new AppError("Evidência não encontrada", 404);
  }

  const quote = await getQuote(id);
  const url = "/api/quotes/" + id + "/evidence/" + filename;
  if (quote.decisionEvidenceUrl !== url) {
    throw new AppError("Evidência não encontrada", 404);
  }

  let file: Buffer;
  try {
    file = await readFile(join(env.EVIDENCE_DIR, filename));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new AppError("Evidência indisponível", 404);
    }
    throw error;
  }

  const extension = filename.split(".").pop() ?? "";
  return res
    .type(mimeByExtension[extension])
    .set("Cache-Control", "private, no-store")
    .set("X-Content-Type-Options", "nosniff")
    .send(file);
};
