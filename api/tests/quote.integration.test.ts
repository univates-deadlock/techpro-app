import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { agentWithCookie, createAuthenticatedUser, type AuthContext } from "./helpers.js";
import type { CreateQuoteItemInput } from "../src/schemas/quote.schema.js";

describe("Quote integration tests", () => {
  let admin: AuthContext;
  let planning: AuthContext;
  let technician: AuthContext;
  let clientId: string;

  const sampleItem: CreateQuoteItemInput = {
    type: "SERVICE",
    description: "Instalação de equipamento",
    quantity: 2,
    unitPrice: 150,
    discount: 0,
  };

  beforeAll(async () => {
    admin = await createAuthenticatedUser("ADMIN");
    planning = await createAuthenticatedUser("PLANNING");
    technician = await createAuthenticatedUser("TECHNICIAN");
  });

  beforeEach(async () => {
    const client = await prisma.client.create({
      data: {
        type: "INDIVIDUAL",
        name: "Cliente Orçamento",
        whatsapp: "5551999999999",
        location: "Porto Alegre",
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

  describe("CRUD workflow (Teste 3)", () => {
    it("completes full lifecycle: create, read, update, and delete draft quote", async () => {
      // 1. Criar um registro
      const createResponse = await agentWithCookie(admin.cookie)
        .post("/api/quotes")
        .send({
          clientId,
          notes: "Orçamento inicial",
          discount: 20,
          items: [sampleItem],
        })
        .expect(201);

      const quoteId = createResponse.body.id as string;
      expect(quoteId).toBeDefined();
      expect(createResponse.body.status).toBe("DRAFT");
      expect(createResponse.body.subtotal).toBe("300");
      expect(createResponse.body.discount).toBe("20");
      expect(createResponse.body.total).toBe("280");

      // 2. Consultar o registro persistido
      const getResponse = await agentWithCookie(admin.cookie)
        .get(`/api/quotes/${quoteId}`)
        .expect(200);

      expect(getResponse.body.id).toBe(quoteId);
      expect(getResponse.body.clientId).toBe(clientId);
      expect(getResponse.body.items).toHaveLength(1);
      expect(getResponse.body.items[0].description).toBe("Instalação de equipamento");

      // 3. Atualizar informações permitidas
      const updateResponse = await agentWithCookie(admin.cookie)
        .patch(`/api/quotes/${quoteId}`)
        .send({
          notes: "Orçamento revisado",
          discount: 50,
        })
        .expect(200);

      expect(updateResponse.body.notes).toBe("Orçamento revisado");
      expect(updateResponse.body.discount).toBe("50");
      expect(updateResponse.body.total).toBe("250");

      // 4. Verificar a persistência da atualização
      const verifyResponse = await agentWithCookie(admin.cookie)
        .get(`/api/quotes/${quoteId}`)
        .expect(200);

      expect(verifyResponse.body.notes).toBe("Orçamento revisado");
      expect(verifyResponse.body.discount).toBe("50");
      expect(verifyResponse.body.total).toBe("250");

      // 5. Excluir o registro conforme as regras de negócio
      await agentWithCookie(admin.cookie)
        .delete(`/api/quotes/${quoteId}`)
        .expect(204);

      // 6. Confirmar o resultado da exclusão
      await agentWithCookie(admin.cookie)
        .get(`/api/quotes/${quoteId}`)
        .expect(404);

      const quoteInDb = await prisma.quote.findUnique({ where: { id: quoteId } });
      expect(quoteInDb).toBeNull();
    });
  });

  describe("Permissions (Teste 1)", () => {
    it("allows PLANNING to create and manage quotes", async () => {
      // Act
      const response = await agentWithCookie(planning.cookie)
        .post("/api/quotes")
        .send({
          clientId,
          items: [sampleItem],
        })
        .expect(201);

      // Assert
      expect(response.body.createdBy).toBe(planning.id);
    });

    it("denies quote creation to TECHNICIAN with 403 Forbidden", async () => {
      // Act
      await agentWithCookie(technician.cookie)
        .post("/api/quotes")
        .send({
          clientId,
          items: [sampleItem],
        })
        .expect(403);

      // Assert
      expect(await prisma.quote.count()).toBe(0);
    });

    it("denies unauthenticated requests with 401 Unauthorized", async () => {
      // Act & Assert
      await request(app)
        .get("/api/quotes")
        .expect(401);
    });
  });

  describe("Business rules", () => {
    it("prevents deletion of non-draft quotes with 409 Conflict", async () => {
      // Arrange
      const quote = await prisma.quote.create({
        data: {
          clientId,
          createdBy: admin.id,
          status: "SENT",
          subtotal: 100,
          discount: 0,
          total: 100,
        },
      });

      // Act & Assert
      await agentWithCookie(admin.cookie)
        .delete(`/api/quotes/${quote.id}`)
        .expect(409);

      const persisted = await prisma.quote.findUnique({ where: { id: quote.id } });
      expect(persisted).not.toBeNull();
    });

    it("recalculates totals when an item is added to an open quote", async () => {
      // Arrange
      const createResponse = await agentWithCookie(admin.cookie)
        .post("/api/quotes")
        .send({
          clientId,
          items: [sampleItem],
        })
        .expect(201);

      const quoteId = createResponse.body.id;

      // Act: add a second item (1 * 100 = 100)
      const addItemResponse = await agentWithCookie(admin.cookie)
        .post(`/api/quotes/${quoteId}/items`)
        .send({
          type: "PRODUCT",
          description: "Peça de reposição",
          quantity: 1,
          unitPrice: 100,
        })
        .expect(201);

      // Assert: previous total 300 + new item 100 = 400
      expect(addItemResponse.body.subtotal).toBe("400");
      expect(addItemResponse.body.total).toBe("400");
      expect(addItemResponse.body.items).toHaveLength(2);
    });

    it("returns 404 when referencing a nonexistent client", async () => {
      // Act & Assert
      await agentWithCookie(admin.cookie)
        .post("/api/quotes")
        .send({
          clientId: randomUUID(),
          items: [sampleItem],
        })
        .expect(404);
    });

    it("atomically updates items, notes, and discounts via PATCH /api/quotes/:id", async () => {
      const createResponse = await agentWithCookie(admin.cookie)
        .post("/api/quotes")
        .send({
          clientId,
          notes: "Proposta v1",
          discount: 0,
          items: [
            {
              type: "SERVICE",
              description: "Instalação básica",
              quantity: 1,
              unitPrice: 100,
              discount: 10,
            },
            {
              type: "PRODUCT",
              description: "Item para remover",
              quantity: 1,
              unitPrice: 50,
              discount: 0,
            },
          ],
        })
        .expect(201);

      const quoteId = createResponse.body.id as string;
      const firstItemId = createResponse.body.items[0].id as string;

      // Update first item to higher value, drop second item, add new item, and raise general discount above old subtotal (140 -> 200)
      const patchResponse = await agentWithCookie(admin.cookie)
        .patch(`/api/quotes/${quoteId}`)
        .send({
          notes: "Proposta v2 revisada",
          discount: 200,
          items: [
            {
              id: firstItemId,
              type: "SERVICE",
              description: "Instalação completa",
              quantity: 2,
              unitPrice: 250,
              discount: 50,
            },
            {
              type: "PRODUCT",
              description: "Central de alarme",
              quantity: 1,
              unitPrice: 400,
              discount: 25,
            },
          ],
        })
        .expect(200);

      // (2 * 250 - 50) + (1 * 400 - 25) = 450 + 375 = 825; total = 825 - 200 = 625
      expect(patchResponse.body.notes).toBe("Proposta v2 revisada");
      expect(patchResponse.body.subtotal).toBe("825");
      expect(patchResponse.body.discount).toBe("200");
      expect(patchResponse.body.total).toBe("625");
      expect(patchResponse.body.items).toHaveLength(2);
      expect(patchResponse.body.items[0].id).toBe(firstItemId);
      expect(patchResponse.body.items[0].description).toBe("Instalação completa");
      expect(patchResponse.body.items[0].discount).toBe("50");
      expect(patchResponse.body.items[1].description).toBe("Central de alarme");
      expect(patchResponse.body.items[1].discount).toBe("25");
    });

    it("rolls back atomic quote edit when discount exceeds updated items subtotal", async () => {
      const createResponse = await agentWithCookie(admin.cookie)
        .post("/api/quotes")
        .send({
          clientId,
          notes: "Intacto",
          discount: 10,
          items: [sampleItem],
        })
        .expect(201);

      const quoteId = createResponse.body.id as string;
      const itemId = createResponse.body.items[0].id as string;

      await agentWithCookie(admin.cookie)
        .patch(`/api/quotes/${quoteId}`)
        .send({
          notes: "Não deve persistir",
          discount: 500,
          items: [
            {
              id: itemId,
              type: "SERVICE",
              description: "Alterado",
              quantity: 1,
              unitPrice: 200,
              discount: 0,
            },
          ],
        })
        .expect(422);

      const persisted = await agentWithCookie(admin.cookie)
        .get(`/api/quotes/${quoteId}`)
        .expect(200);

      expect(persisted.body.notes).toBe("Intacto");
      expect(persisted.body.discount).toBe("10");
      expect(persisted.body.items[0].description).toBe("Instalação de equipamento");
    });
  });

  describe("Quote status transitions", () => {
    const createDraft = async (items = [sampleItem]) => {
      const response = await agentWithCookie(admin.cookie)
        .post("/api/quotes")
        .send({ clientId, items })
        .expect(201);

      return response.body.id as string;
    };

    it("records the sender from the active session and keeps SENT quotes editable", async () => {
      const id = await createDraft();
      const sent = await agentWithCookie(planning.cookie)
        .post(`/api/quotes/${id}/send`)
        .expect(200);

      expect(sent.body).toMatchObject({
        status: "SENT",
        createdBy: admin.id,
        sentAt: expect.any(String),
        sentBy: planning.id,
        decidedAt: null,
        decidedBy: null,
      });

      await agentWithCookie(admin.cookie).post(`/api/quotes/${id}/send`).expect(409);
      await agentWithCookie(admin.cookie)
        .patch(`/api/quotes/${id}`)
        .send({ notes: "Atualizado após o envio" })
        .expect(200);
      await agentWithCookie(admin.cookie)
        .delete(`/api/quotes/${id}/items/${sent.body.items[0].id}`)
        .expect(409);

      const persisted = await agentWithCookie(admin.cookie).get(`/api/quotes/${id}`).expect(200);
      expect(persisted.body).toMatchObject({
        sentAt: sent.body.sentAt,
        sentBy: planning.id,
        notes: "Atualizado após o envio",
      });
    });

    it("rejects sending an empty draft and leaves its audit fields unset", async () => {
      const id = await createDraft([]);
      await agentWithCookie(admin.cookie).post(`/api/quotes/${id}/send`).expect(409);

      const persisted = await agentWithCookie(admin.cookie).get(`/api/quotes/${id}`).expect(200);
      expect(persisted.body).toMatchObject({ status: "DRAFT", sentAt: null, sentBy: null });
    });

    it.each([
      { action: "approve", status: "APPROVED" },
      { action: "reject", status: "REJECTED" },
      { action: "expire", status: "EXPIRED" },
    ])("records $status once and freezes the decided quote", async ({ action, status }) => {
      const id = await createDraft();
      const payload = {
        decidedAt: "2026-11-10T14:30:00-03:00",
        decisionNotes: "  Retorno registrado  ",
      };
      const decisionPath = `/api/quotes/${id}/${action}`;
      await agentWithCookie(planning.cookie).post(decisionPath).send(payload).expect(409);

      const sent = await agentWithCookie(admin.cookie).post(`/api/quotes/${id}/send`).expect(200);
      const decision = await agentWithCookie(planning.cookie).post(decisionPath).send(payload).expect(200);

      const audit = {
        status,
        sentAt: sent.body.sentAt,
        sentBy: admin.id,
        decidedAt: "2026-11-10T17:30:00.000Z",
        decidedBy: planning.id,
        decisionNotes: "Retorno registrado",
        decisionEvidenceUrl: null,
      };
      expect(decision.body).toMatchObject(audit);

      await agentWithCookie(admin.cookie).post(decisionPath).send(payload).expect(409);
      await agentWithCookie(admin.cookie)
        .patch(`/api/quotes/${id}`)
        .send({ notes: "Alteração indevida" })
        .expect(409);
      await agentWithCookie(admin.cookie).post(`/api/quotes/${id}/items`).send(sampleItem).expect(409);
      await agentWithCookie(admin.cookie).delete(`/api/quotes/${id}`).expect(409);

      const persisted = await agentWithCookie(admin.cookie).get(`/api/quotes/${id}`).expect(200);
      expect(persisted.body).toMatchObject(audit);
    });

    it.each(["send", "approve", "reject", "expire"])("protects the %s endpoint", async (action) => {
      const path = `/api/quotes/${randomUUID()}/${action}`;
      const payload = action === "reject" ? { decisionNotes: "Motivo" } : {};
      await request(app).post(path).send(payload).expect(401);
      await agentWithCookie(technician.cookie).post(path).send(payload).expect(403);
      await agentWithCookie(admin.cookie).post(path).send(payload).expect(404);
    });

    it("validates IDs and decision data and accepts approval with no body", async () => {
      const id = await createDraft();
      const path = `/api/quotes/${id}`;
      await agentWithCookie(admin.cookie).post("/api/quotes/invalid/send").expect(400);
      await agentWithCookie(admin.cookie).post(`${path}/send`).send({ sentBy: planning.id }).expect(400);
      await agentWithCookie(admin.cookie).post(`${path}/send`).expect(200);

      await agentWithCookie(admin.cookie).post(`${path}/reject`).send({ decisionNotes: "   " }).expect(400);
      const stillSent = await agentWithCookie(admin.cookie).get(path).expect(200);
      expect(stillSent.body).toMatchObject({
        status: "SENT",
        decidedAt: null,
        decidedBy: null,
        decisionNotes: null,
      });
      await agentWithCookie(admin.cookie)
        .post(`${path}/expire`)
        .send({ decidedAt: "2026-11-10T14:30:00" })
        .expect(400);
      await agentWithCookie(admin.cookie).post(`${path}/approve`).send({ decidedBy: planning.id }).expect(400);
      await agentWithCookie(admin.cookie)
        .post(`${path}/approve`)
        .send({ decisionEvidenceUrl: "https://example.test/evidence.pdf" })
        .expect(400);

      const approved = await agentWithCookie(admin.cookie).post(`${path}/approve`).expect(200);
      await agentWithCookie(planning.cookie)
        .post(`${path}/reject`)
        .send({ decisionNotes: "Tentativa de alterar decisão final" })
        .expect(409);
      expect(approved.body).toMatchObject({
        status: "APPROVED",
        decidedAt: expect.any(String),
        decidedBy: admin.id,
        decisionNotes: null,
      });
      const persisted = await agentWithCookie(admin.cookie).get(path).expect(200);
      expect(persisted.body.status).toBe("APPROVED");
      expect(persisted.body.decisionNotes).toBeNull();
    });

    it("allows only one concurrent decision to persist", async () => {
      const id = await createDraft();
      const path = `/api/quotes/${id}`;
      await agentWithCookie(admin.cookie).post(`${path}/send`).expect(200);

      const responses = await Promise.all([
        agentWithCookie(admin.cookie).post(`${path}/approve`).send({ decisionNotes: "Aceitou" }),
        agentWithCookie(planning.cookie).post(`${path}/reject`).send({ decisionNotes: "Recusou" }),
      ]);

      expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
      const persisted = await agentWithCookie(admin.cookie).get(path).expect(200);
      if (responses[0].status === 200) {
        expect(persisted.body).toMatchObject({
          status: "APPROVED", decidedBy: admin.id, decisionNotes: "Aceitou",
        });
      } else {
        expect(persisted.body).toMatchObject({
          status: "REJECTED", decidedBy: planning.id, decisionNotes: "Recusou",
        });
      }
    });

    it("serializes sending against removal of the last item", async () => {
      const id = await createDraft();
      const path = `/api/quotes/${id}`;
      const draft = await agentWithCookie(admin.cookie).get(path).expect(200);

      const [send, remove] = await Promise.all([
        agentWithCookie(admin.cookie).post(`${path}/send`),
        agentWithCookie(planning.cookie).delete(`${path}/items/${draft.body.items[0].id}`),
      ]);

      expect([send.status, remove.status].sort()).toEqual([200, 409]);
      const persisted = await agentWithCookie(admin.cookie).get(path).expect(200);
      expect(persisted.body.status).toBe(send.status === 200 ? "SENT" : "DRAFT");
      expect(persisted.body.items).toHaveLength(send.status === 200 ? 1 : 0);
    });
  });
});
