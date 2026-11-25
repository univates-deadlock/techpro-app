import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { createUser } from "../src/services/user.service.js";
import { agentWithCookie, createAuthenticatedUser, type AuthContext } from "./helpers.js";

describe("Critical visit scheduling workflows", () => {
  let admin: AuthContext;
  let planning: AuthContext;
  let technician: AuthContext;
  let technician2: { id: string };
  let clientId: string;

  // Relative dates keep scheduling tests valid after the delivery date.
  const today = new Date();
  const at = (hour: number, day = 1) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, day, hour)).toISOString();
  const visitPayload = { scheduledStart: at(12), scheduledEnd: at(15), description: "Instalação do evaporador" };

  const technicianIdsOf = (body: { technicians: { technician: { id: string } }[] }) =>
    body.technicians.map((item) => item.technician.id).sort();

  const idsOf = (body: { id: string }[]) => body.map((visit) => visit.id);

  const planner = () => agentWithCookie(planning.cookie);

  const createService = (status = "PLANNED") =>
    prisma.service.create({
      data: {
        clientId,
        origin: "SUPPORT",
        status,
        title: "Serviço de teste",
        createdBy: admin.id,
      },
    });

  const createVisit = (
    serviceId: string,
    options: { status?: string; start?: string; end?: string | null } = {}
  ) => {
    const { status = "SCHEDULED", start = at(12), end = at(15) } = options;
    return prisma.serviceVisit.create({
      data: {
        serviceId,
        scheduledStart: new Date(start),
        scheduledEnd: end ? new Date(end) : null,
        status,
      },
    });
  };

  // Assignment-only fixtures do not need a session or a sign-in request.
  const createTechnician = () => createUser({
    name: "Test technician",
    email: `technician-${randomUUID()}@test.local`,
    role: "TECHNICIAN",
    password: "Fictitious-password-123",
  });

  beforeAll(async () => {
    admin = await createAuthenticatedUser("ADMIN");
    planning = await createAuthenticatedUser("PLANNING");
    technician = await createAuthenticatedUser("TECHNICIAN");
    technician2 = await createTechnician();
  });

  beforeEach(async () => {
    const client = await prisma.client.create({
      data: {
        type: "INDIVIDUAL",
        name: "Cliente de Visitas",
        whatsapp: "5551999999999",
        location: "Lajeado",
      },
    });
    clientId = client.id;
  });

  afterEach(async () => {
    // Visits (and their technician links) are removed with their service (onDelete: Cascade).
    await prisma.service.deleteMany();
    await prisma.quote.deleteMany();
    await prisma.client.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("schedules, lists, reads and reschedules a visit", async () => {
    const service = await createService();
    const servicePath = "/api/services/" + service.id + "/visits";

    const created = await planner().post(servicePath).send(visitPayload).expect(201);
    expect(created.body).toMatchObject({
      serviceId: service.id,
      status: "SCHEDULED",
      description: "Instalação do evaporador",
      actualStart: null,
      actualEnd: null,
      technicians: [],
    });
    const visitId = created.body.id as string;

    const persisted = await prisma.serviceVisit.findUniqueOrThrow({ where: { id: visitId } });
    expect(persisted.status).toBe("SCHEDULED");
    expect(persisted.scheduledStart.toISOString()).toBe(at(12));

    // A visit scheduled earlier must come first in the list.
    await agentWithCookie(admin.cookie)
      .post(servicePath)
      .send({ scheduledStart: at(11) })
      .expect(201);
    const list = await agentWithCookie(admin.cookie).get(servicePath).expect(200);
    expect(list.body).toHaveLength(2);
    expect(new Date(list.body[0].scheduledStart as string).getTime()).toBeLessThan(
      new Date(list.body[1].scheduledStart as string).getTime()
    );

    // The location comes from the client (the visit has no location of its own).
    const detail = await agentWithCookie(admin.cookie).get("/api/visits/" + visitId).expect(200);
    expect(detail.body.service.client.location).toBe("Lajeado");

    const rescheduled = await planner()
      .patch("/api/visits/" + visitId)
      .send({
        scheduledStart: at(12, 2),
        scheduledEnd: at(14, 2),
      })
      .expect(200);
    expect(new Date(rescheduled.body.scheduledStart as string).toISOString()).toBe(at(12, 2));
    expect(rescheduled.body.description).toBe("Instalação do evaporador");
  });

  it("rejects invalid input without creating or changing visits", async () => {
    const service = await createService();
    const servicePath = "/api/services/" + service.id + "/visits";

    const endBeforeStart = await agentWithCookie(admin.cookie)
      .post(servicePath)
      .send({
        scheduledStart: at(15),
        scheduledEnd: at(12),
      })
      .expect(400);
    expect(endBeforeStart.body.fields).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "scheduledEnd" })])
    );

    const asAdmin = agentWithCookie(admin.cookie);
    await asAdmin.post(servicePath).send({ scheduledStart: "01/12/2026 09:00" }).expect(400);
    await asAdmin.post(servicePath).send({}).expect(400);
    // Status is not a creation field: the visit always starts as SCHEDULED.
    await asAdmin.post(servicePath).send({ ...visitPayload, status: "COMPLETED" }).expect(400);
    await asAdmin.post(servicePath).send({ ...visitPayload, technicianIds: "x" }).expect(400);
    await asAdmin.post(servicePath).send({ ...visitPayload, confirmConflicts: "sim" }).expect(400);
    await asAdmin.post("/api/services/not-a-uuid/visits").send(visitPayload).expect(400);
    expect(await prisma.serviceVisit.count()).toBe(0);

    const visit = await createVisit(service.id);
    const path = "/api/visits/" + visit.id;
    await asAdmin.patch(path).send({}).expect(400);
    // confirmConflicts alone changes nothing, so it is not a valid update.
    await asAdmin.patch(path).send({ confirmConflicts: true }).expect(400);
    await asAdmin.patch(path).send({ status: "COMPLETED" }).expect(400);
    await asAdmin.get("/api/visits/not-a-uuid").expect(400);

    // Only the start is sent: the end is validated against the stored value (15:00 UTC).
    await asAdmin.patch(path).send({ scheduledStart: at(16) }).expect(422);

    const unchanged = await prisma.serviceVisit.findUniqueOrThrow({ where: { id: visit.id } });
    expect(unchanged.status).toBe("SCHEDULED");
    expect(unchanged.scheduledStart.toISOString()).toBe(at(12));
  });

  it("enforces service and visit state rules and missing records", async () => {
    for (const status of ["COMPLETED", "CANCELLED"]) {
      const closed = await createService(status);
      await agentWithCookie(admin.cookie)
        .post("/api/services/" + closed.id + "/visits")
        .send(visitPayload)
        .expect(409);
      expect(await prisma.serviceVisit.count({ where: { serviceId: closed.id } })).toBe(0);
    }

    const open = await createService();
    for (const status of ["IN_PROGRESS", "COMPLETED", "CANCELLED"]) {
      const visit = await createVisit(open.id, { status });
      await planner()
        .patch("/api/visits/" + visit.id)
        .send({ description: "Edição indevida" })
        .expect(409);
      const unchanged = await prisma.serviceVisit.findUniqueOrThrow({ where: { id: visit.id } });
      expect(unchanged.description).toBeNull();
    }

    const asAdmin = agentWithCookie(admin.cookie);
    await asAdmin.post("/api/services/" + randomUUID() + "/visits").send(visitPayload).expect(404);
    await asAdmin.get("/api/services/" + randomUUID() + "/visits").expect(404);
    await asAdmin.get("/api/visits/" + randomUUID()).expect(404);
    await asAdmin.patch("/api/visits/" + randomUUID()).send({ description: "x" }).expect(404);
  });

  it("assigns, replaces and removes technicians atomically", async () => {
    const service = await createService();
    const servicePath = "/api/services/" + service.id + "/visits";

    // One visit accepts several technicians, saved together with the visit.
    const created = await planner()
      .post(servicePath)
      .send({ ...visitPayload, technicianIds: [technician.id, technician2.id] })
      .expect(201);
    expect(technicianIdsOf(created.body)).toEqual([technician.id, technician2.id].sort());
    const visitId = created.body.id as string;
    const path = "/api/visits/" + visitId + "/technicians";
    const links = () => prisma.visitTechnician.count({ where: { visitId } });
    expect(await links()).toBe(2);

    // Sending a shorter list unassigns the missing technician.
    const reduced = await planner().put(path).send({ technicianIds: [technician.id] }).expect(200);
    expect(technicianIdsOf(reduced.body)).toEqual([technician.id]);
    expect(await links()).toBe(1);

    // Duplicated ids are collapsed.
    await planner().put(path).send({ technicianIds: [technician2.id, technician2.id] }).expect(200);
    expect(await links()).toBe(1);
    expect((await prisma.visitTechnician.findFirstOrThrow({ where: { visitId } })).technicianId).toBe(
      technician2.id
    );

    // An empty list removes everyone.
    await planner().put(path).send({ technicianIds: [] }).expect(200);
    expect(await links()).toBe(0);

    // Only active technicians: other roles, inactive users and unknown ids are refused.
    const inactive = await createTechnician();
    await prisma.user.update({ where: { id: inactive.id }, data: { isActive: false } });
    await planner().put(path).send({ technicianIds: [technician.id] }).expect(200);
    for (const invalidId of [planning.id, inactive.id, randomUUID()]) {
      await planner().put(path).send({ technicianIds: [technician.id, invalidId] }).expect(422);
    }
    // The previous assignment is untouched after the refused requests.
    expect((await prisma.visitTechnician.findFirstOrThrow({ where: { visitId } })).technicianId).toBe(
      technician.id
    );
    expect(await links()).toBe(1);

    // Invalid bodies.
    await planner().put(path).send({}).expect(400);
    await planner().put(path).send({ technicianIds: "x" }).expect(400);
    await planner().put(path).send({ technicianIds: [""] }).expect(400);
    await planner().put(path).send({ technicianIds: [], extra: true }).expect(400);
    await planner()
      .put(path)
      .send({ technicianIds: Array.from({ length: 11 }, (_, index) => "tech-" + index) })
      .expect(400);

    // Atomicity: an invalid technician prevents the visit from being created at all.
    await planner()
      .post(servicePath)
      .send({ ...visitPayload, technicianIds: [technician.id, planning.id] })
      .expect(422);
    expect(await prisma.serviceVisit.count({ where: { serviceId: service.id } })).toBe(1);

    // Only SCHEDULED visits accept changes; missing visits return 404.
    const started = await createVisit(service.id, { status: "IN_PROGRESS" });
    await planner()
      .put("/api/visits/" + started.id + "/technicians")
      .send({ technicianIds: [technician.id] })
      .expect(409);
    expect(await prisma.visitTechnician.count({ where: { visitId: started.id } })).toBe(0);
    await planner()
      .put("/api/visits/" + randomUUID() + "/technicians")
      .send({ technicianIds: [] })
      .expect(404);
  });

  it("flags technician schedule conflicts and accepts an explicit confirmation", async () => {
    const serviceA = await createService();
    const serviceB = await createService();
    const pathA = "/api/services/" + serviceA.id + "/visits";
    const pathB = "/api/services/" + serviceB.id + "/visits";

    const base = await planner()
      .post(pathA)
      .send({ scheduledStart: at(12), scheduledEnd: at(15), technicianIds: [technician.id] })
      .expect(201);

    // Same technician, overlapping window (14:00–16:00 vs 12:00–15:00): nothing is saved.
    const blocked = await planner()
      .post(pathB)
      .send({ scheduledStart: at(14), scheduledEnd: at(16), technicianIds: [technician.id] })
      .expect(409);
    expect(blocked.body.conflicts).toHaveLength(1);
    expect(blocked.body.conflicts[0]).toMatchObject({
      technician: { id: technician.id },
      visit: { id: base.body.id, serviceId: serviceA.id, serviceTitle: "Serviço de teste" },
    });
    expect(blocked.body.confirmation).toEqual(expect.stringContaining("confirmConflicts"));
    expect(await prisma.serviceVisit.count({ where: { serviceId: serviceB.id } })).toBe(0);

    // A visit starting exactly when the other ends is not a conflict, and neither is
    // another technician in the same window.
    await planner()
      .post(pathB)
      .send({ scheduledStart: at(15), scheduledEnd: at(17), technicianIds: [technician.id] })
      .expect(201);
    await planner()
      .post(pathB)
      .send({ scheduledStart: at(13), scheduledEnd: at(14), technicianIds: [technician2.id] })
      .expect(201);

    // With the explicit confirmation the visit is saved despite the conflict.
    const confirmed = await planner()
      .post(pathB)
      .send({
        scheduledStart: at(14),
        scheduledEnd: at(16),
        technicianIds: [technician.id],
        confirmConflicts: true,
      })
      .expect(201);
    expect(technicianIdsOf(confirmed.body)).toEqual([technician.id]);
  });

  it("ignores cancelled visits and assumes a default duration when there is no end", async () => {
    const serviceA = await createService();
    const serviceB = await createService();
    const pathA = "/api/services/" + serviceA.id + "/visits";
    const pathB = "/api/services/" + serviceB.id + "/visits";

    // A cancelled visit does not occupy the technician.
    const cancelled = await createVisit(serviceA.id, { status: "CANCELLED" });
    await prisma.visitTechnician.create({
      data: { visitId: cancelled.id, technicianId: technician.id },
    });
    await planner()
      .post(pathB)
      .send({ scheduledStart: at(13), scheduledEnd: at(14), technicianIds: [technician.id] })
      .expect(201);

    // Visit without end (09:00): treated as lasting 2 hours (09:00–11:00).
    await planner()
      .post(pathA)
      .send({ scheduledStart: at(9, 2), technicianIds: [technician2.id] })
      .expect(201);
    await planner()
      .post(pathB)
      .send({ scheduledStart: at(10, 2), scheduledEnd: at(12, 2), technicianIds: [technician2.id] })
      .expect(409);
    // The new visit has no end either (08:00–10:00 overlaps 09:00–11:00).
    await planner()
      .post(pathB)
      .send({ scheduledStart: at(8, 2), technicianIds: [technician2.id] })
      .expect(409);
    // Starting exactly when the assumed window ends is allowed.
    await planner()
      .post(pathB)
      .send({ scheduledStart: at(11, 2), scheduledEnd: at(12, 2), technicianIds: [technician2.id] })
      .expect(201);
  });

  it("checks conflicts when assigning technicians and when rescheduling", async () => {
    const serviceA = await createService();
    const serviceB = await createService();
    const pathA = "/api/services/" + serviceA.id + "/visits";
    const pathB = "/api/services/" + serviceB.id + "/visits";

    const base = await planner()
      .post(pathA)
      .send({ scheduledStart: at(12), scheduledEnd: at(15), technicianIds: [technician.id] })
      .expect(201);

    // Without technicians there is nothing to conflict with.
    const free = await planner()
      .post(pathB)
      .send({ scheduledStart: at(12), scheduledEnd: at(15) })
      .expect(201);
    const freePath = "/api/visits/" + (free.body.id as string);

    // Assigning the busy technician is flagged and saves nothing...
    const blocked = await planner()
      .put(freePath + "/technicians")
      .send({ technicianIds: [technician.id] })
      .expect(409);
    expect(blocked.body.conflicts[0].visit.id).toBe(base.body.id);
    expect(await prisma.visitTechnician.count({ where: { visitId: free.body.id } })).toBe(0);

    // ...until it is confirmed explicitly.
    const confirmed = await planner()
      .put(freePath + "/technicians")
      .send({ technicianIds: [technician.id], confirmConflicts: true })
      .expect(200);
    expect(technicianIdsOf(confirmed.body)).toEqual([technician.id]);

    // Keeping the same technician is not a new assignment, so it is not blocked again.
    await planner()
      .put(freePath + "/technicians")
      .send({ technicianIds: [technician.id] })
      .expect(200);

    // Rescheduling a visit with technicians re-checks their schedule.
    const moving = await planner()
      .post(pathB)
      .send({ scheduledStart: at(18), scheduledEnd: at(19), technicianIds: [technician.id] })
      .expect(201);
    const movingPath = "/api/visits/" + (moving.body.id as string);

    const blockedMove = await planner()
      .patch(movingPath)
      .send({ scheduledStart: at(13), scheduledEnd: at(14) })
      .expect(409);
    expect(idsOf(blockedMove.body.conflicts.map((item: { visit: { id: string } }) => item.visit))).toEqual(
      expect.arrayContaining([base.body.id as string, free.body.id as string])
    );
    const unchanged = await prisma.serviceVisit.findUniqueOrThrow({
      where: { id: moving.body.id as string },
    });
    expect(unchanged.scheduledStart.toISOString()).toBe(at(18));

    // Editing only text does not re-check the schedule.
    await planner().patch(movingPath).send({ notes: "Levar escada" }).expect(200);

    // Confirmed reschedule is saved.
    const moved = await planner()
      .patch(movingPath)
      .send({ scheduledStart: at(13), scheduledEnd: at(14), confirmConflicts: true })
      .expect(200);
    expect(new Date(moved.body.scheduledStart as string).toISOString()).toBe(at(13));
  });

  it("filters visits by service, technician, status and period", async () => {
    const service1 = await createService();
    const service2 = await createService();
    const visit1 = await createVisit(service1.id, { start: at(9, 1), end: at(10, 1) });
    const visit2 = await createVisit(service1.id, {
      start: at(9, 2),
      end: at(10, 2),
      status: "COMPLETED",
    });
    const visit3 = await createVisit(service2.id, { start: at(9, 3), end: at(10, 3) });
    await prisma.visitTechnician.createMany({
      data: [
        { visitId: visit1.id, technicianId: technician.id },
        { visitId: visit3.id, technicianId: technician.id },
        { visitId: visit2.id, technicianId: technician2.id },
      ],
    });

    const list = (query: Record<string, string>) =>
      planner().get("/api/visits").query(query).expect(200);

    // Everything, ordered by scheduled start.
    expect(idsOf((await list({})).body)).toEqual([visit1.id, visit2.id, visit3.id]);
    expect(idsOf((await list({ serviceId: service1.id })).body)).toEqual([visit1.id, visit2.id]);
    expect(idsOf((await list({ technicianId: technician.id })).body)).toEqual([
      visit1.id,
      visit3.id,
    ]);
    expect(idsOf((await list({ status: "COMPLETED" })).body)).toEqual([visit2.id]);
    expect(idsOf((await list({ from: at(0, 2), to: at(23, 2) })).body)).toEqual([visit2.id]);
    expect(idsOf((await list({ technicianId: technician.id, from: at(0, 3) })).body)).toEqual([
      visit3.id,
    ]);
    expect((await list({ status: "CANCELLED" })).body).toEqual([]);

    // Invalid filters.
    await planner().get("/api/visits").query({ status: "UNKNOWN" }).expect(400);
    await planner().get("/api/visits").query({ from: "not-a-date" }).expect(400);
    await planner().get("/api/visits").query({ from: at(0, 3), to: at(0, 2) }).expect(400);
    await planner().get("/api/visits").query({ serviceId: "not-a-uuid" }).expect(400);
  });

  it("rejects new and rescheduled past visits but allows closing overdue visits", async () => {
    const service = await createService();
    const past = new Date(Date.now() - 86400000).toISOString();
    await planner().post("/api/services/" + service.id + "/visits").send({ scheduledStart: past }).expect(422);
    const scheduled = await createVisit(service.id);
    await planner().patch("/api/visits/" + scheduled.id).send({ scheduledStart: past }).expect(422);
    const overdue = await createVisit(service.id, { start: past, end: null });
    const closed = await planner().patch("/api/visits/" + overdue.id + "/execution").send({ status: "COMPLETED", notes: "Concluída" }).expect(200);
    expect(closed.body).toMatchObject({ status: "COMPLETED", actualStart: null, notes: "Concluída" });
    expect(closed.body.actualEnd).toBeTruthy();
    await planner().patch("/api/visits/" + overdue.id + "/execution").send({ status: "IN_PROGRESS" }).expect(409);
  });

  it("lists active technicians and restricts execution to assigned technicians or planners", async () => {
    const options = await planner().get("/api/visits/technicians").expect(200);
    expect(options.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: technician.id })]));
    expect(options.body.every((item: Record<string, unknown>) => Object.keys(item).sort().join(",") === "id,name")).toBe(true);
    const service = await createService();
    const visit = await createVisit(service.id);
    const path = "/api/visits/" + visit.id;
    const tech = agentWithCookie(technician.cookie);
    await tech.patch(path + "/execution").send({ status: "IN_PROGRESS" }).expect(403);
    await planner().patch(path).send({ technicianIds: [technician.id] }).expect(200);
    expect(idsOf((await tech.get("/api/visits").query({ technicianId: technician2.id }).expect(200)).body)).toEqual([visit.id]);
    await tech.patch(path + "/execution").send({ status: "IN_PROGRESS" }).expect(200);
    const closed = await tech.patch(path + "/execution").send({ status: "COMPLETED" }).expect(200);
    expect(closed.body.actualStart).toBeTruthy();
    expect(closed.body.actualEnd).toBeTruthy();
    await tech.patch(path + "/status").send({ status: "CANCELLED" }).expect(403);
    const second = await createVisit(service.id);
    await planner().patch("/api/visits/" + second.id + "/status").send({ status: "CANCELLED" }).expect(200);
  });

  it("protects visit data from anonymous and technician requests", async () => {
    const service = await createService();
    const visit = await createVisit(service.id);
    const servicePath = "/api/services/" + service.id + "/visits";
    const visitPath = "/api/visits/" + visit.id;
    const techniciansPath = visitPath + "/technicians";

    await request(app).get("/api/visits").expect(401);
    await request(app).get(servicePath).expect(401);
    await request(app).post(servicePath).send(visitPayload).expect(401);
    await request(app).get(visitPath).expect(401);
    await request(app).patch(visitPath).send({ description: "x" }).expect(401);
    await request(app).put(techniciansPath).send({ technicianIds: [technician.id] }).expect(401);

    const tech = agentWithCookie(technician.cookie);
    expect((await tech.get("/api/visits").expect(200)).body).toEqual([]);
    await tech.get(servicePath).expect(403);
    await tech.post(servicePath).send(visitPayload).expect(403);
    await tech.get(visitPath).expect(403);
    await tech.patch(visitPath).send({ description: "x" }).expect(403);
    await tech.put(techniciansPath).send({ technicianIds: [technician.id] }).expect(403);

    expect(await prisma.serviceVisit.count()).toBe(1);
    expect(await prisma.visitTechnician.count()).toBe(0);
    const unchanged = await prisma.serviceVisit.findUniqueOrThrow({ where: { id: visit.id } });
    expect(unchanged.description).toBeNull();
  });
});