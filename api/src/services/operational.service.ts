import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";

import { businessWindow, warrantyDateBounds } from "../utils/businessWindow.js";

const MAX_ITEMS = 20;

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
  const warrantyDates = warrantyDateBounds(window);
  const activeStatuses = ["PENDING", "SCHEDULED"] as const;
  const revisionsOverdue: Prisma.RevisionWhereInput = {
    status: { in: [...activeStatuses] }, scheduledAt: { lt: window.start },
  };
  const revisionsUpcoming: Prisma.RevisionWhereInput = {
    status: { in: [...activeStatuses] },
    scheduledAt: { gte: window.start, lt: window.endExclusive },
  };
  const warrantiesExpired: Prisma.WarrantyWhereInput = {
    endsAt: { lt: warrantyDates.start },
  };
  const warrantiesExpiring: Prisma.WarrantyWhereInput = {
    endsAt: { gte: warrantyDates.start, lt: warrantyDates.endExclusive },
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
