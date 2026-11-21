import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";

const TIME_ZONE = "America/Sao_Paulo";
const MAX_ITEMS = 20;

const dateFormat = new Intl.DateTimeFormat("sv-SE", {
  timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
});
const offsetFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE, timeZoneName: "longOffset",
});

// Return the UTC instant of midnight in the business timezone. Use the zone's
// actual offset, not a machine-local date or a permanently hard-coded UTC-3.
function businessMidnight(year: number, month: number, day: number): Date {
  const noon = new Date(Date.UTC(year, month - 1, day, 12));
  const name = offsetFormat.formatToParts(noon).find((part) => part.type === "timeZoneName")?.value;
  const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(name ?? "");
  if (!match) throw new Error("Não foi possível determinar o fuso horário do negócio");
  const sign = match[1] === "+" ? 1 : -1;
  const minutes = sign * (Number(match[2]) * 60 + Number(match[3]));
  return new Date(Date.UTC(year, month - 1, day) - minutes * 60_000);
}

export function businessWindow(now: Date, days: number) {
  const day = dateFormat.format(now);
  const [year, month, date] = day.split("-").map(Number);
  return {
    days,
    timeZone: TIME_ZONE,
    start: businessMidnight(year, month, date),
    endExclusive: businessMidnight(year, month, date + days),
  };
}

const revisionSelect = {
  id: true, serviceId: true, visitId: true, scheduledAt: true, status: true, notes: true,
  service: { select: { id: true, title: true, client: { select: { id: true, name: true } } } },
} satisfies Prisma.RevisionSelect;

const warrantySelect = {
  id: true, serviceId: true, type: true, description: true, startsAt: true, endsAt: true,
  service: { select: { id: true, title: true, client: { select: { id: true, name: true } } } },
} satisfies Prisma.WarrantySelect;

export async function getAlerts(days = 14, now = new Date()) {
  const window = businessWindow(now, days);
  const activeStatuses = ["PENDING", "SCHEDULED"] as const;
  const revisionsOverdue: Prisma.RevisionWhereInput = {
    status: { in: [...activeStatuses] }, scheduledAt: { lt: window.start },
  };
  const revisionsUpcoming: Prisma.RevisionWhereInput = {
    status: { in: [...activeStatuses] },
    scheduledAt: { gte: window.start, lt: window.endExclusive },
  };
  const warrantiesExpired: Prisma.WarrantyWhereInput = {
    endsAt: { lt: window.start },
  };
  const warrantiesExpiring: Prisma.WarrantyWhereInput = {
    endsAt: { gte: window.start, lt: window.endExclusive },
  };

  const [overdueRevisionCount, upcomingRevisionCount, expiredWarrantyCount, expiringWarrantyCount,
    overdueRevisions, upcomingRevisions, expiredWarranties, expiringWarranties] = await Promise.all([
    prisma.revision.count({ where: revisionsOverdue }),
    prisma.revision.count({ where: revisionsUpcoming }),
    prisma.warranty.count({ where: warrantiesExpired }),
    prisma.warranty.count({ where: warrantiesExpiring }),
    prisma.revision.findMany({
      where: revisionsOverdue, select: revisionSelect, orderBy: [{ scheduledAt: "asc" }, { id: "asc" }], take: MAX_ITEMS,
    }),
    prisma.revision.findMany({
      where: revisionsUpcoming, select: revisionSelect, orderBy: [{ scheduledAt: "asc" }, { id: "asc" }], take: MAX_ITEMS,
    }),
    prisma.warranty.findMany({
      where: warrantiesExpired, select: warrantySelect, orderBy: [{ endsAt: "asc" }, { id: "asc" }], take: MAX_ITEMS,
    }),
    prisma.warranty.findMany({
      where: warrantiesExpiring, select: warrantySelect, orderBy: [{ endsAt: "asc" }, { id: "asc" }], take: MAX_ITEMS,
    }),
  ]);

  return {
    window,
    revisions: {
      overdue: { count: overdueRevisionCount, items: overdueRevisions },
      upcoming: { count: upcomingRevisionCount, items: upcomingRevisions },
    },
    warranties: {
      expired: { count: expiredWarrantyCount, items: expiredWarranties },
      expiring: { count: expiringWarrantyCount, items: expiringWarranties },
    },
  };
}

export async function getDashboard(days = 14, now = new Date()) {
  const window = businessWindow(now, days);
  const serviceWhere: Prisma.ServiceWhereInput = {
    plannedStart: { gte: window.start, lt: window.endExclusive },
    status: { notIn: ["CANCELLED", "COMPLETED"] },
  };
  const visitWhere: Prisma.ServiceVisitWhereInput = {
    scheduledStart: { gte: window.start, lt: window.endExclusive },
    status: { notIn: ["CANCELLED", "COMPLETED"] },
  };
  const [alerts, quoteGroups, serviceCount, visitCount, upcomingServices, upcomingVisits] = await Promise.all([
    getAlerts(days, now),
    prisma.quote.groupBy({ by: ["status"], _count: { id: true } }),
    prisma.service.count({ where: serviceWhere }),
    prisma.serviceVisit.count({ where: visitWhere }),
    prisma.service.findMany({
      where: serviceWhere, take: MAX_ITEMS,
      select: {
        id: true, title: true, status: true, plannedStart: true,
        client: { select: { id: true, name: true } },
      },
      orderBy: [{ plannedStart: "asc" }, { id: "asc" }],
    }),
    prisma.serviceVisit.findMany({
      where: visitWhere, take: MAX_ITEMS,
      select: {
        id: true, status: true, scheduledStart: true,
        service: { select: { id: true, title: true, client: { select: { id: true, name: true } } } },
      },
      orderBy: [{ scheduledStart: "asc" }, { id: "asc" }],
    }),
  ]);
  const quotes: Record<string, number> = {
    DRAFT: 0, SENT: 0, APPROVED: 0, REJECTED: 0, EXPIRED: 0,
  };
  for (const group of quoteGroups) quotes[group.status] = group._count.id;

  return {
    window,
    quotes,
    services: { upcoming: { count: serviceCount, items: upcomingServices } },
    visits: { upcoming: { count: visitCount, items: upcomingVisits } },
    alerts,
  };
}
