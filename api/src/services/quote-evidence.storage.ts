import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

let client: S3Client | undefined;

/** The private bucket is accessed using scoped application credentials. */
function storage() {
  if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    throw new AppError("Armazenamento de evidências não configurado", 503);
  }

  client ??= new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    maxAttempts: 2,
  });
  return { client, bucket: env.S3_BUCKET };
}

function storageFailure(error: unknown): AppError {
  const name = (error as { name?: string })?.name;
  if (name === "NoSuchKey" || name === "NotFound") {
    return new AppError("Evidência indisponível", 404);
  }
  // Never expose storage URLs, raw SDK errors or credentials.
  console.error("[EVIDENCE_STORAGE]: S3 request failed");
  return new AppError("Armazenamento de evidências indisponível", 503);
}

export async function putEvidenceObject(key: string, bytes: Buffer, type: string) {
  const { client, bucket } = storage();
  try {
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: bytes,
      ContentType: type,
      ContentLength: bytes.byteLength,
    }));
  } catch (error) {
    throw storageFailure(error);
  }
}

export async function readEvidenceObject(key: string): Promise<Buffer> {
  const { client, bucket } = storage();
  try {
    const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!result.Body) throw new AppError("Evidência indisponível", 404);
    return Buffer.from(await result.Body.transformToByteArray());
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw storageFailure(error);
  }
}

export async function deleteEvidenceObject(key: string) {
  const { client, bucket } = storage();
  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch (error) {
    throw storageFailure(error);
  }
}
