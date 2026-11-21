import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { agentWithCookie, createAuthenticatedUser, type AuthContext } from "./helpers.js";

describe("Quote decision API used by the detail screen", () => {
  let admin: AuthContext;
  let technician: AuthContext;
  let clientId: string;

  beforeAll(async () => {
    admin = await createAuthenticatedUser("ADMIN");
    technician = await createAuthenticatedUser("TECHNICIAN");
  });

  beforeEach(async () => {
    const client = await prisma.client.create({
      data: {
        type: "INDIVIDUAL",
        name: "Cliente do fluxo comercial",
        whatsapp: "5551999999999",
        location: "Lajeado",
      },
    });
    clientId = client.id;
  });

  afterEach(async () => {
    await prisma.quote.deleteMany();
    await prisma.client.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("protects send/approve actions and makes the resulting decision immutable", async () => {
    const created = await agentWithCookie(admin.cookie)
      .post("/api/quotes")
      .send({
        clientId,
        items: [{
          type: "SERVICE",
          description: "Instalação",
          quantity: 1,
          unitPrice: 250,
        }],
      })
      .expect(201);

    const path = "/api/quotes/" + created.body.id;
    await request(app).post(path + "/send").expect(401);
    await agentWithCookie(technician.cookie).post(path + "/send").expect(403);

    const sent = await agentWithCookie(admin.cookie)
      .post(path + "/send").expect(200);
    expect(sent.body.status).toBe("SENT");

    await agentWithCookie(admin.cookie)
      .post(path + "/reject")
      .send({ decisionNotes: "   " })
      .expect(400);
    const unchanged = await agentWithCookie(admin.cookie).get(path).expect(200);
    expect(unchanged.body.status).toBe("SENT");
    expect(unchanged.body.decidedAt).toBeNull();

    const approved = await agentWithCookie(admin.cookie)
      .post(path + "/approve").send({}).expect(200);
    expect(approved.body.status).toBe("APPROVED");
    await agentWithCookie(admin.cookie)
      .patch(path).send({ notes: "Não pode editar" }).expect(409);
    expect((await prisma.quote.findUniqueOrThrow({
      where: { id: created.body.id as string },
    })).status).toBe("APPROVED");
  });
});
