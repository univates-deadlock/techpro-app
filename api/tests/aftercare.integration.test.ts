import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { businessWindow, warrantyDateBounds } from "../src/utils/businessWindow.js";
import { agentWithCookie, createAuthenticatedUser, type AuthContext } from "./helpers.js";

describe("Aftercare endpoints and operational indicators", () => {
  let admin: AuthContext;
  let planning: AuthContext;
  let technician: AuthContext;
  let clientId: string;
  let serviceId: string;

  const makeService = (client: string, creator: string) => prisma.service.create({
    data: {
      clientId: client,
      createdBy: creator,
      origin: "SUPPORT",
      status: "PLANNED",
      title: "Instalação do sistema de segurança",
    },
  });

  beforeAll(async () => {
    admin = await createAuthenticatedUser("ADMIN");
    planning = await createAuthenticatedUser("PLANNING");
    technician = await createAuthenticatedUser("TECHNICIAN");
  });

  afterEach(async () => {
    await prisma.revision.deleteMany();
    await prisma.warranty.deleteMany();
    await prisma.visitTechnician.deleteMany();
    await prisma.serviceVisit.deleteMany();
    await prisma.service.deleteMany();
    await prisma.quote.deleteMany();
    await prisma.client.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // Create a fresh service for each test, rather than coupling tests to the
  // not-yet-merged /services API work in #112.
  beforeEach(async () => {
    const client = await prisma.client.create({
      data: {
        type: "INDIVIDUAL",
        name: "Cliente Fictício",
        whatsapp: "5551999999999",
        location: "Lajeado",
      },
    });
    clientId = client.id;
    const service = await makeService(clientId, admin.id);
    serviceId = service.id;
  });

  it("requires authentication and denies technician access to financial/aftercare data", async () => {
    for (const endpoint of ["/api/warranties", "/api/revisions", "/api/alerts", "/api/dashboard"]) {
      await request(app).get(endpoint).expect(401);
      await agentWithCookie(technician.cookie).get(endpoint).expect(403);
    }
  });

  it("supports multiple warranties, filters, partial edits and deletion", async () => {
    const first = await agentWithCookie(planning.cookie).post("/api/warranties").send({
      serviceId, type: "SERVICE", startsAt: "2026-11-01", endsAt: "2027-11-01",
      description: "Instalação",
    }).expect(201);
    const second = await agentWithCookie(admin.cookie).post("/api/warranties").send({
      serviceId, type: "MANUFACTURER", startsAt: "2026-11-05", endsAt: "2028-11-05",
      manufacturer: "Fabricante fictício", productReference: "XYZ",
    }).expect(201);

    expect(await prisma.warranty.count({ where: { serviceId } })).toBe(2);
    const listed = await agentWithCookie(planning.cookie)
      .get("/api/warranties?type=MANUFACTURER").expect(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].id).toBe(second.body.id);

    const changed = await agentWithCookie(admin.cookie)
      .patch("/api/warranties/" + first.body.id)
      .send({ endsAt: "2027-12-01", notes: "Prorrogada" }).expect(200);
    expect(changed.body.endsAt).toContain("2027-12-01");

    await agentWithCookie(admin.cookie).delete("/api/warranties/" + first.body.id).expect(204);
    await agentWithCookie(admin.cookie).get("/api/warranties/" + first.body.id).expect(404);
  });

  it("rejects invalid warranty dates and manufacturer-only fields on a service warranty", async () => {
    const base = { serviceId, type: "SERVICE", startsAt: "2026-11-05", endsAt: "2026-11-01" };
    await agentWithCookie(admin.cookie).post("/api/warranties").send(base).expect(400);
    await agentWithCookie(admin.cookie).post("/api/warranties")
      .send({ ...base, startsAt: "2026-02-30", endsAt: "2026-11-10" }).expect(400);
    await agentWithCookie(admin.cookie).post("/api/warranties")
      .send({ ...base, endsAt: "2026-11-10", manufacturer: "Não permitido" }).expect(400);
    expect(await prisma.warranty.count()).toBe(0);
  });

  it("validates revision associations, transitions and terminal-state immutability", async () => {
    const otherService = await makeService(clientId, admin.id);
    const unrelatedVisit = await prisma.serviceVisit.create({
      data: {
        serviceId: otherService.id,
        scheduledStart: new Date("2026-12-01T12:00:00Z"),
        status: "PLANNED",
      },
    });
    await agentWithCookie(admin.cookie).post("/api/revisions").send({
      serviceId, visitId: unrelatedVisit.id, scheduledAt: "2026-12-01T12:00:00Z",
    }).expect(409);

    const created = await agentWithCookie(admin.cookie).post("/api/revisions").send({
      serviceId, scheduledAt: "2026-12-01T12:00:00Z", notes: "Retorno previsto",
    }).expect(201);
    expect(created.body.status).toBe("PENDING");

    await agentWithCookie(admin.cookie).patch("/api/revisions/" + created.body.id)
      .send({ status: "COMPLETED" }).expect(200);
    await agentWithCookie(admin.cookie).patch("/api/revisions/" + created.body.id)
      .send({ status: "SCHEDULED" }).expect(409);
    await agentWithCookie(admin.cookie).patch("/api/revisions/" + created.body.id)
      .send({ scheduledAt: "2026-12-04T12:00:00Z" }).expect(409);
    await agentWithCookie(admin.cookie).delete("/api/revisions/" + created.body.id).expect(409);
  });

  it("links a scheduled revision to a visit of the same service", async () => {
    const visit = await prisma.serviceVisit.create({
      data: { serviceId, scheduledStart: new Date("2026-12-01T12:00:00Z"), status: "PLANNED" },
    });
    const created = await agentWithCookie(admin.cookie).post("/api/revisions")
      .send({ serviceId, scheduledAt: "2026-12-01T12:00:00Z" }).expect(201);
    const updated = await agentWithCookie(planning.cookie)
      .patch("/api/revisions/" + created.body.id)
      .send({ status: "SCHEDULED", visitId: visit.id }).expect(200);
    expect(updated.body.visitId).toBe(visit.id);
    const filtered = await agentWithCookie(planning.cookie)
      .get("/api/revisions?status=SCHEDULED&clientId=" + clientId).expect(200);
    expect(filtered.body).toHaveLength(1);
  });

  it("counts nearby and overdue items without marking completed revisions as pending", async () => {
    const window = businessWindow(new Date(), 14);
    const { start } = window;
    const warrantyToday = warrantyDateBounds(window).start;
    const overdue = new Date(start.getTime() - 86_400_000);
    const upcoming = new Date(start.getTime() + 86_400_000);
    const dateOnly = (date: Date) => date.toISOString().slice(0, 10);

    await prisma.revision.createMany({ data: [
      { serviceId, status: "PENDING", scheduledAt: overdue },
      { serviceId, status: "SCHEDULED", scheduledAt: upcoming },
      { serviceId, status: "COMPLETED", scheduledAt: overdue },
    ] });
    await prisma.warranty.createMany({ data: [
      { serviceId, type: "SERVICE", startsAt: new Date("2020-01-01T00:00:00Z"), endsAt: new Date(dateOnly(overdue) + "T00:00:00Z") },
      { serviceId, type: "SERVICE", startsAt: new Date("2020-01-01T00:00:00Z"), endsAt: new Date(dateOnly(upcoming) + "T00:00:00Z") },
      { serviceId, type: "SERVICE", startsAt: new Date("2020-01-01T00:00:00Z"), endsAt: warrantyToday },
    ] });
    await prisma.serviceVisit.create({
      data: { serviceId, scheduledStart: upcoming, status: "PLANNED" },
    });
    await prisma.service.update({ where: { id: serviceId }, data: { plannedStart: upcoming } });

    const alerts = await agentWithCookie(admin.cookie).get("/api/alerts?days=14").expect(200);
    expect(alerts.body.revisions.overdue.count).toBe(1);
    expect(alerts.body.revisions.upcoming.count).toBe(1);
    expect(alerts.body.warranties.expired.count).toBe(1);
    expect(alerts.body.warranties.expiring.count).toBe(2);

    const dashboard = await agentWithCookie(planning.cookie).get("/api/dashboard?days=14").expect(200);
    expect(dashboard.body.services.upcoming.count).toBe(1);
    expect(dashboard.body.visits.upcoming.count).toBe(1);
    expect(dashboard.body.alerts.revisions.overdue.count).toBe(1);
  });

  it("validates the configurable alert window", async () => {
    await agentWithCookie(admin.cookie).get("/api/alerts?days=0").expect(400);
    await agentWithCookie(admin.cookie).get("/api/dashboard?days=91").expect(400);
    await agentWithCookie(admin.cookie).get("/api/alerts?unexpected=true").expect(400);
  });
});
