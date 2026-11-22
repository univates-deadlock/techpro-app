import {
  CreateBucketCommand, S3Client,
} from "@aws-sdk/client-s3";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import app from "../src/app.js";
import { env } from "../src/config/env.js";
import { prisma } from "../src/lib/prisma.js";
import { agentWithCookie, createAuthenticatedUser, type AuthContext } from "./helpers.js";

describe("Protected S3 quote approval evidence", () => {
  let admin: AuthContext;
  let planning: AuthContext;
  let technician: AuthContext;
  let quoteId: string;
  const pdf = Buffer.from("%PDF-1.7\n1 0 obj\nendobj\n%%EOF\n");

  beforeAll(async () => {
    const s3 = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID!,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: true,
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
    await s3.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }));
    s3.destroy();
    admin = await createAuthenticatedUser("ADMIN");
    planning = await createAuthenticatedUser("PLANNING");
    technician = await createAuthenticatedUser("TECHNICIAN");
  });

  beforeEach(async () => {
    const client = await prisma.client.create({
      data: { type: "INDIVIDUAL", name: "Cliente Fictício", whatsapp: "5551999999999", location: "Lajeado" },
    });
    const quote = await prisma.quote.create({
      data: { clientId: client.id, createdBy: admin.id, status: "APPROVED", subtotal: 0, discount: 0, total: 0 },
    });
    quoteId = quote.id;
  });

  afterEach(async () => {
    await prisma.quote.deleteMany();
    await prisma.client.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("uploads to RustFS, records an object key, and serves authenticated downloads", async () => {
    const upload = await agentWithCookie(admin.cookie)
      .post("/api/quotes/" + quoteId + "/evidence")
      .set("Content-Type", "application/pdf")
      .send(pdf).expect(201);
    const url = upload.body.url as string;
    expect(url).toMatch(/^\/api\/quotes\/[0-9a-f-]+\/evidence\/[0-9a-f-]+\.pdf$/);

    const stored = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(stored.decisionEvidenceUrl).toMatch(/^quotes\/[0-9a-f-]+\/[0-9a-f-]+\.pdf$/);
    expect(stored.decisionEvidenceUrl).not.toContain("http");
    const quoteResponse = await agentWithCookie(admin.cookie)
      .get("/api/quotes/" + quoteId).expect(200);
    expect(quoteResponse.body.decisionEvidenceUrl).toBe(url);


    const download = await agentWithCookie(planning.cookie).get(url).expect(200);
    expect(download.headers["content-type"]).toMatch(/application\/pdf/);
    expect(download.headers["cache-control"]).toBe("private, no-store");
    expect(download.body).toEqual(pdf);

    await request(app).get(url).expect(401);
    await agentWithCookie(technician.cookie).get(url).expect(403);
    await agentWithCookie(admin.cookie)
      .get("/api/quotes/" + quoteId + "/evidence/00000000-0000-0000-0000-000000000000.pdf")
      .expect(404);
  });

  it("rejects duplicate uploads and invalid statuses", async () => {
    const route = "/api/quotes/" + quoteId + "/evidence";
    await agentWithCookie(admin.cookie).post(route)
      .set("Content-Type", "application/pdf").send(pdf).expect(201);
    await agentWithCookie(admin.cookie).post(route)
      .set("Content-Type", "application/pdf").send(pdf).expect(409);
    await prisma.quote.update({ where: { id: quoteId }, data: { status: "REJECTED", decisionEvidenceUrl: null } });
    await agentWithCookie(admin.cookie).post(route)
      .set("Content-Type", "application/pdf").send(pdf).expect(409);
  });

  it("rejects anonymous uploads, technicians, unsupported MIME types and spoofed bytes", async () => {
    const route = "/api/quotes/" + quoteId + "/evidence";
    await request(app).post(route)
      .set("Content-Type", "application/pdf").send(pdf).expect(401);
    await agentWithCookie(technician.cookie).post(route)
      .set("Content-Type", "application/pdf").send(pdf).expect(403);
    await agentWithCookie(admin.cookie).post(route)
      .set("Content-Type", "text/plain").send("not a file").expect(415);
    await agentWithCookie(admin.cookie).post(route)
      .set("Content-Type", "image/png").send(pdf).expect(400);
    expect(await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } }))
      .toHaveProperty("decisionEvidenceUrl", null);
  });

  it("rejects files larger than 10 MiB before touching storage", async () => {
    const route = "/api/quotes/" + quoteId + "/evidence";
    const oversized = Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(10 * 1024 * 1024)]);
    await agentWithCookie(admin.cookie).post(route)
      .set("Content-Type", "application/pdf").send(oversized).expect(413);
    expect((await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } })).decisionEvidenceUrl).toBeNull();
  });

  it("supports independent JPEG and PNG uploads for separate approved quotes", async () => {
    const jpeg = Buffer.from("/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/ALMAD//Z", "base64");
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mP4//8/AAX+Av4zEpUUAAAAAElFTkSuQmCC", "base64");
    const first = await agentWithCookie(admin.cookie)
      .post("/api/quotes/" + quoteId + "/evidence")
      .set("Content-Type", "image/jpeg").send(jpeg).expect(201);
    expect((await agentWithCookie(admin.cookie).get(first.body.url).expect(200)).body).toEqual(jpeg);

    const client = await prisma.client.findFirstOrThrow({ select: { id: true } });
    const quote = await prisma.quote.create({
      data: { clientId: client.id, createdBy: admin.id, status: "APPROVED", subtotal: 0, discount: 0, total: 0 },
    });
    const second = await agentWithCookie(planning.cookie)
      .post("/api/quotes/" + quote.id + "/evidence")
      .set("Content-Type", "image/png").send(png).expect(201);
    expect((await agentWithCookie(admin.cookie).get(second.body.url).expect(200)).body).toEqual(png);
  });
});
