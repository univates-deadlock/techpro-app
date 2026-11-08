import { prisma } from "../lib/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { MAX_QUOTE_ITEMS } from "../schemas/quote.schema.js";
import type {
  CreateQuoteInput,
  CreateQuoteItemInput,
  ListQuotesQuery,
  QuoteStatusValue,
  UpdateQuoteInput,
  UpdateQuoteItemInput,
  ApproveQuoteInput,
  RejectQuoteInput,
} from "../schemas/quote.schema.js";
import { AppError } from "../utils/AppError.js";
import { calcItemSubtotal, calcQuoteTotals, toDecimal } from "./quote.calculations.js";

// 1) ============= Selects =============
export const quoteItemSelect = {
  id: true,
  quoteId: true,
  type: true,
  description: true,
  quantity: true,
  unitPrice: true,
  discount: true,
  subtotal: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.QuoteItemSelect;

const quoteBaseSelect = {
  id: true,
  clientId: true,
  status: true,
  subtotal: true,
  discount: true,
  total: true,
  notes: true,
  createdBy: true,
  sentAt: true,
  decidedAt: true,
  decisionNotes: true,
  decisionEvidenceUrl: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, name: true, type: true } },
} satisfies Prisma.QuoteSelect;

export const quoteListSelect = {
  ...quoteBaseSelect,
  _count: { select: { items: true } },
} satisfies Prisma.QuoteSelect;

export const quoteDetailSelect = {
  ...quoteBaseSelect,
  items: { select: quoteItemSelect, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
} satisfies Prisma.QuoteSelect;

// 2) ============= Internal helpers =============
// "Open" quote = can be edited (decision not yet recorded)
const isOpen = (status: QuoteStatusValue) => status === "DRAFT" || status === "SENT";

const buildItemData = (input: CreateQuoteItemInput) => {
  const quantity = toDecimal(input.quantity);
  const unitPrice = toDecimal(input.unitPrice);
  const discount = toDecimal(input.discount ?? 0);

  return {
    type: input.type,
    description: input.description,
    quantity,
    unitPrice,
    discount,
    subtotal: calcItemSubtotal({ quantity, unitPrice, discount }),
  };
};

// Locks the quote and ensures it exists.
const getQuoteForUpdateOrThrow = async (tx: Prisma.TransactionClient, id: string) => {
  // Prisma has no row-lock API. Lock the parent before reading state or editing items
  // so concurrent mutations of this quote use the latest status, discount, and items.
  await tx.$queryRaw`SELECT "id" FROM "quote" WHERE "id" = ${id}::uuid FOR UPDATE`;

  const quote = await tx.quote.findUnique({
    where: { id },
    select: { id: true, status: true, discount: true },
  });

  if (!quote) {
    throw new AppError("Orçamento não encontrado", 404);
  }

  return quote;
};

const getOpenQuoteOrThrow = async (tx: Prisma.TransactionClient, id: string) => {
  const quote = await getQuoteForUpdateOrThrow(tx, id);

  if (!isOpen(quote.status)) {
    throw new AppError("Orçamento com decisão registrada não pode ser alterado", 409);
  }

  return quote;
};

// Recalculates subtotal/total from the items. Always call inside a transaction.
const recalculateQuote = async (
  tx: Prisma.TransactionClient,
  quoteId: string,
  currentDiscount: Prisma.Decimal,
  newDiscount?: number
) => {
  const items = await tx.quoteItem.findMany({
    where: { quoteId },
    select: { subtotal: true },
  });

  const totals = calcQuoteTotals(
    items.map((item) => item.subtotal),
    newDiscount === undefined ? currentDiscount : toDecimal(newDiscount)
  );

  await tx.quote.update({
    where: { id: quoteId },
    data: { subtotal: totals.subtotal, discount: totals.discount, total: totals.total },
  });
};

const findQuoteDetail = async (tx: Prisma.TransactionClient, id: string) =>
  tx.quote.findUniqueOrThrow({ where: { id }, select: quoteDetailSelect });

// 3) ============= List quotes (optional filters) =============
export const getAllQuotes = async (filters: ListQuotesQuery) =>
  prisma.quote.findMany({
    where: {
      ...(filters.clientId && { clientId: filters.clientId }),
      ...(filters.status && { status: filters.status }),
    },
    select: quoteListSelect,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });

// 4) ============= Search quote by ID (with items) =============
export const getQuoteById = async (id: string) => {
  const quote = await prisma.quote.findUnique({ where: { id }, select: quoteDetailSelect });

  if (!quote) {
    throw new AppError("Orçamento não encontrado", 404);
  }

  return quote;
};

// 5) ============= Create quote (with items) =============
export const createQuote = async (data: CreateQuoteInput, userId: string) => {
  const client = await prisma.client.findUnique({
    where: { id: data.clientId },
    select: { id: true, active: true },
  });

  if (!client) {
    throw new AppError("Cliente não encontrado", 404);
  }

  if (!client.active) {
    throw new AppError("Não é possível criar orçamento para um cliente inativo", 409);
  }

  const items = (data.items ?? []).map(buildItemData);
  const totals = calcQuoteTotals(
    items.map((item) => item.subtotal),
    toDecimal(data.discount ?? 0)
  );

  // Nested create: the quote and its items are saved together (all or nothing)
  return prisma.quote.create({
    data: {
      clientId: data.clientId,
      createdBy: userId,
      status: "DRAFT",
      notes: data.notes ?? null,
      subtotal: totals.subtotal,
      discount: totals.discount,
      total: totals.total,
      items: { create: items },
    },
    select: quoteDetailSelect,
  });
};

// 6) ============= Update quote (notes / overall discount / items) =============
export const updateQuote = async (id: string, data: UpdateQuoteInput) =>
  prisma.$transaction(async (tx) => {
    const quote = await getOpenQuoteOrThrow(tx, id);

    if (data.items !== undefined) {
      if (quote.status === "SENT" && data.items.length === 0) {
        throw new AppError("Um orçamento enviado precisa ter pelo menos um item", 409);
      }

      const incomingIds = data.items
        .map((item) => item.id)
        .filter((itemId): itemId is string => itemId !== undefined);

      if (new Set(incomingIds).size !== incomingIds.length) {
        throw new AppError("Itens duplicados na atualização do orçamento", 400);
      }

      const existingItems = await tx.quoteItem.findMany({
        where: { quoteId: id },
        select: { id: true },
      });
      const existingIds = new Set(existingItems.map((item) => item.id));

      for (const itemId of incomingIds) {
        if (!existingIds.has(itemId)) {
          throw new AppError("Item não encontrado neste orçamento", 404);
        }
      }

      const preparedItems = data.items.map((item) => ({
        id: item.id,
        data: buildItemData(item),
      }));

      const effectiveDiscount =
        data.discount === undefined ? quote.discount : toDecimal(data.discount);
      const totals = calcQuoteTotals(
        preparedItems.map((item) => item.data.subtotal),
        effectiveDiscount
      );

      const retainedIdSet = new Set(incomingIds);
      const idsToDelete = existingItems
        .filter((item) => !retainedIdSet.has(item.id))
        .map((item) => item.id);

      if (idsToDelete.length > 0) {
        await tx.quoteItem.deleteMany({
          where: { id: { in: idsToDelete }, quoteId: id },
        });
      }

      for (const prepared of preparedItems) {
        if (prepared.id) {
          await tx.quoteItem.update({
            where: { id: prepared.id },
            data: prepared.data,
          });
        } else {
          await tx.quoteItem.create({
            data: { quoteId: id, ...prepared.data },
          });
        }
      }

      await tx.quote.update({
        where: { id },
        data: {
          ...(data.notes !== undefined && { notes: data.notes }),
          subtotal: totals.subtotal,
          discount: totals.discount,
          total: totals.total,
        },
      });

      return findQuoteDetail(tx, id);
    }

    if (data.notes !== undefined) {
      await tx.quote.update({ where: { id }, data: { notes: data.notes } });
    }

    if (data.discount !== undefined) {
      await recalculateQuote(tx, id, quote.discount, data.discount);
    }

    return findQuoteDetail(tx, id);
  });

// 7) ============= Delete quote =============
export const deleteQuote = async (id: string) =>
  prisma.$transaction(async (tx) => {
    const quote = await getQuoteForUpdateOrThrow(tx, id);

    if (quote.status !== "DRAFT") {
      throw new AppError("Apenas orçamentos em rascunho podem ser excluídos", 409);
    }

    // Items are deleted together with the quote.
    await tx.quote.delete({ where: { id } });
  });

// 8) ============= Add item =============
export const addQuoteItem = async (quoteId: string, data: CreateQuoteItemInput) =>
  prisma.$transaction(async (tx) => {
    const quote = await getOpenQuoteOrThrow(tx, quoteId);

    const totalItems = await tx.quoteItem.count({ where: { quoteId } });
    if (totalItems >= MAX_QUOTE_ITEMS) {
      throw new AppError("Máximo de 100 itens por orçamento", 409);
    }

    await tx.quoteItem.create({ data: { quoteId, ...buildItemData(data) } });
    await recalculateQuote(tx, quoteId, quote.discount);

    return findQuoteDetail(tx, quoteId);
  });

// 9) ============= Update item =============
export const updateQuoteItem = async (
  quoteId: string,
  itemId: string,
  data: UpdateQuoteItemInput
) =>
  prisma.$transaction(async (tx) => {
    const quote = await getOpenQuoteOrThrow(tx, quoteId);

    const current = await tx.quoteItem.findFirst({
      where: { id: itemId, quoteId },
      select: quoteItemSelect,
    });

    if (!current) {
      throw new AppError("Item não encontrado neste orçamento", 404);
    }

    // Partial PATCH: omitted fields retain their current values.
    const merged = buildItemData({
      type: data.type ?? current.type,
      description: data.description ?? current.description,
      quantity: data.quantity ?? current.quantity.toNumber(),
      unitPrice: data.unitPrice ?? current.unitPrice.toNumber(),
      discount: data.discount ?? current.discount.toNumber(),
    });

    await tx.quoteItem.update({ where: { id: itemId }, data: merged });
    await recalculateQuote(tx, quoteId, quote.discount);

    return findQuoteDetail(tx, quoteId);
  });

// 10) ============= Delete item =============
export const deleteQuoteItem = async (quoteId: string, itemId: string) =>
  prisma.$transaction(async (tx) => {
    const quote = await getOpenQuoteOrThrow(tx, quoteId);

    const item = await tx.quoteItem.findFirst({
      where: { id: itemId, quoteId },
      select: { id: true },
    });

    if (!item) {
      throw new AppError("Item não encontrado neste orçamento", 404);
    }

    // A sent quote must keep at least one item.
    if (quote.status === "SENT") {
      const totalItems = await tx.quoteItem.count({ where: { quoteId } });
      if (totalItems <= 1) {
        throw new AppError("Um orçamento enviado precisa ter pelo menos um item", 409);
      }
    }

    await tx.quoteItem.delete({ where: { id: itemId } });
    await recalculateQuote(tx, quoteId, quote.discount);

    return findQuoteDetail(tx, quoteId);
  });

  // 11) ============= Send Quote (DRAFT --> SENT) =============
export const sendQuote = async (id: string) =>
  prisma.$transaction(async (tx) => {
    const quote = await getOpenQuoteOrThrow(tx, id);

    if(quote.status !== "DRAFT") {
      throw new AppError("Apenas orçamentos em rascunho podem ser enviados", 409);
    }

    const countItems = await tx.quoteItem.count({ where: { quoteId: id } });
    if(countItems === 0) {
      throw new AppError("Não é possível enviar um orçamento sem itens", 409);
    }

    await tx.quote.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date() },
    });

    return findQuoteDetail(tx, id);
  });

  // 12) ============= Approve Quote (SENT --> APPROVED) =============
export const approveQuote = async (id: string, data: ApproveQuoteInput) =>
  prisma.$transaction(async (tx) => {
    const quote = await getOpenQuoteOrThrow(tx, id);

    if(quote.status !== "SENT") {
      throw new AppError("Apenas orçamentos enviados podem ser aprovados", 409);
    }

    await tx.quote.update({
      where: { id },
      data: {
        status: "APPROVED",
        decidedAt: new Date(),
        decisionNotes: data.decisionNotes ?? null,
        decisionEvidenceUrl: data.decisionEvidenceUrl ?? null,
      },
    });

    return findQuoteDetail(tx, id);
  });

  // 13) ============= Reject Quote (SENT --> REJECTED) =============
export const rejectQuote = async (id: string, data: RejectQuoteInput) =>
  prisma.$transaction(async (tx) => {
    const quote = await getOpenQuoteOrThrow(tx, id);

    if(quote.status !== "SENT") {
      throw new AppError("Apenas orçamentos enviados podem ser rejeitados", 409);
    }

    await tx.quote.update({
      where: { id },
      data: {
        status: "REJECTED",
        decidedAt: new Date(),
        decisionNotes: data.decisionNotes,
        decisionEvidenceUrl: data.decisionEvidenceUrl ?? null,
      },
    });

    return findQuoteDetail(tx, id);
  });