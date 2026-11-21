import { rm } from "node:fs/promises";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import app from "../src/app.js";
import { env } from "../src/config/env.js";
import { prisma } from "../src/lib/prisma.js";
import { agentWithCookie, createAuthenticatedUser, type AuthContext } from "./helpers.js";

describe("Protected quote approval evidence", () => {
  let admin: AuthContext;
  let planning: AuthContext;
  let technician: AuthContext;
  let quoteId: string;
  const pdf = Buffer.from("%PDF-1.7\n1 0 obj\n");

  beforeAll(async () => {
    admin = await createAuthenticatedUser("ADMIN");
    planning = await createAuthenticatedUser("PLANNING");
    technician = await createAuthenticatedUser("TECHNICIAN");
  });

  beforeEach(async () => {
    const client = await prisma.client.create({
      data: {
        type: "INDIVIDUAL", name: "Cliente Fictício",
        whatsapp: "5551999999999", location: "Lajeado",
      },
    });
    const quote = await prisma.quote.create({
      data: {
        clientId: client.id, createdBy: admin.id, status: "APPROVED",
        subtotal: 0, discount: 0, total: 0,
      },
    });
    quoteId = quote.id;
  });

  afterEach(async () => {
    await prisma.quote.deleteMany();
    await prisma.client.deleteMany();
  });

  afterAll(async () => {
    await rm(env.EVIDENCE_DIR, { recursive: true, force: true });
    await prisma.$disconnect();
  });

  it("stores and retrieves an authenticated PDF without exposing the directory", async () => {
    const upload = await agentWithCookie(admin.cookie)
      .post("/api/quotes/" + quoteId + "/evidence")
      .set("Content-Type", "application/pdf")
      .send(pdf)
      .expect(201);
    const url = upload.body.url as string;
    expect(url).toMatch(/^\/api\/quotes\/[0-9a-f-]+\/evidence\/[0-9a-f-]+\.pdf$/);

    const stored = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(stored.decisionEvidenceUrl).toBe(url);

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

  it("rejects unauthenticated, unauthorized, unsupported and spoofed files", async () => {
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
});
