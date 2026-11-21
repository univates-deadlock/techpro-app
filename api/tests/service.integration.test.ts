import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { agentWithCookie, createAuthenticatedUser, type AuthContext } from "./helpers.js";

describe("Critical service workflows", () => {
  let admin: AuthContext;
  let planning: AuthContext;
  let technician: AuthContext;
  let clientId: string;

  const direct = (id: string) => ({
    origin: "SUPPORT",
    clientId: id,
    title: "Instalação de câmera",
  });

  beforeAll(async () => {
    admin = await createAuthenticatedUser("ADMIN");
    planning = await createAuthenticatedUser("PLANNING");
    technician = await createAuthenticatedUser("TECHNICIAN");
  });

  beforeEach(async () => {
    const client = await prisma.client.create({
      data: {
        type: "INDIVIDUAL",
        name: "Cliente de Serviços",
        whatsapp: "5551999999999",
        location: "Lajeado",
      },
    });
    clientId = client.id;
  });

  afterEach(async () => {
    await prisma.service.deleteMany();
    await prisma.quote.deleteMany();
    await prisma.client.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a direct service with the session owner and blocks inactive clients", async () => {
    const response = await agentWithCookie(planning.cookie)
      .post("/api/services")
      .send(direct(clientId))
      .expect(201);
    expect(response.body).toMatchObject({
      clientId,
      quoteId: null,
      status: "PLANNED",
      origin: "SUPPORT",
      createdBy: planning.id,
    });

    const persisted = await prisma.service.findUniqueOrThrow({
      where: { id: response.body.id as string },
    });
    expect(persisted.createdBy).toBe(planning.id);

    await prisma.client.update({ where: { id: clientId }, data: { active: false } });
    await agentWithCookie(admin.cookie)
      .post("/api/services")
      .send(direct(clientId))
      .expect(409);
    expect(await prisma.service.count()).toBe(1);
  });

  it("allows one service per approved quote, including simultaneous requests", async () => {
    const rejected = await prisma.quote.create({
      data: {
        clientId, createdBy: admin.id, status: "REJECTED",
        subtotal: 0, discount: 0, total: 0,
      },
    });
    await agentWithCookie(admin.cookie)
      .post("/api/services")
      .send({ origin: "QUOTE", quoteId: rejected.id, title: "Serviço recusado" })
      .expect(409);

    const approved = await prisma.quote.create({
      data: {
        clientId, createdBy: admin.id, status: "APPROVED",
        subtotal: 0, discount: 0, total: 0, notes: "Instalar fechadura",
      },
    });
    const payload = { origin: "QUOTE", quoteId: approved.id, title: "Instalação" };
    const responses = await Promise.all([
      agentWithCookie(admin.cookie).post("/api/services").send(payload),
      agentWithCookie(planning.cookie).post("/api/services").send(payload),
    ]);
    expect(responses.map((result) => result.status).sort()).toEqual([201, 409]);
    const service = await prisma.service.findUniqueOrThrow({ where: { quoteId: approved.id } });
    expect(service.clientId).toBe(clientId);
    expect(service.description).toBe("Instalar fechadura");
    expect(await prisma.service.count({ where: { quoteId: approved.id } })).toBe(1);
  });

  it("enforces status transitions and prevents editing a completed service", async () => {
    const service = await agentWithCookie(admin.cookie)
      .post("/api/services")
      .send(direct(clientId))
      .expect(201);
    const path = "/api/services/" + service.body.id;

    await agentWithCookie(admin.cookie)
      .patch(path + "/status").send({ status: "COMPLETED" }).expect(409);
    await agentWithCookie(admin.cookie)
      .patch(path + "/status").send({ status: "IN_PROGRESS" }).expect(200);
    const completed = await agentWithCookie(admin.cookie)
      .patch(path + "/status").send({ status: "COMPLETED" }).expect(200);
    expect(completed.body.completedAt).toEqual(expect.any(String));

    await agentWithCookie(admin.cookie)
      .patch(path).send({ title: "Edição indevida" }).expect(409);
    await agentWithCookie(admin.cookie)
      .patch(path + "/status").send({ status: "IN_PROGRESS" }).expect(409);

    const reference = await agentWithCookie(planning.cookie)
      .patch(path).send({ externalOsNumber: "OS-2026-001" }).expect(200);
    expect(reference.body.externalOsNumber).toBe("OS-2026-001");
    expect((await prisma.service.findUniqueOrThrow({
      where: { id: service.body.id as string },
    })).status).toBe("COMPLETED");
  });

  it("protects service data from anonymous and technician requests", async () => {
    await request(app).get("/api/services").expect(401);
    await request(app).post("/api/services").send(direct(clientId)).expect(401);
    await agentWithCookie(technician.cookie).get("/api/services").expect(403);
    await agentWithCookie(technician.cookie)
      .post("/api/services").send(direct(clientId)).expect(403);
    expect(await prisma.service.count()).toBe(0);
  });
});
