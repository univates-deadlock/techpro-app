import type { Request, Response } from "express";
import {
  createQuoteItemSchema,
  createQuoteSchema,
  listQuotesQuerySchema,
  quoteIdSchema,
  quoteItemIdSchema,
  updateQuoteItemSchema,
  updateQuoteSchema,
  approveQuoteSchema,
  rejectQuoteSchema,
} from "../schemas/quote.schema.js";
import * as quoteService from "../services/quote.service.js";
import { AppError } from "../utils/AppError.js";

// The requireActiveUser middleware stores the authenticated user in res.locals.user.
const getAuthenticatedUserId = (res: Response): string => {
  const user = res.locals.user as { id?: string } | undefined;

  if (!user?.id) {
    throw new AppError("Usuário não autenticado", 401);
  }

  return user.id;
};

// 1) list All 
export const getAllQuotes = async (req: Request, res: Response) => {
  const filters = listQuotesQuerySchema.parse(req.query);
  const quotes = await quoteService.getAllQuotes(filters);
  return res.json(quotes);
};

// 2) search by id
export const getQuoteById = async (req: Request, res: Response) => {
  const id = quoteIdSchema.parse(req.params.id);
  const quote = await quoteService.getQuoteById(id);
  return res.json(quote);
};

// 3) create new
export const createQuote = async (req: Request, res: Response) => {
  const validatedData = createQuoteSchema.parse(req.body);
  const quote = await quoteService.createQuote(validatedData, getAuthenticatedUserId(res));
  return res.status(201).json(quote);
};

// 4) update
export const updateQuote = async (req: Request, res: Response) => {
  const id = quoteIdSchema.parse(req.params.id);
  const validatedData = updateQuoteSchema.parse(req.body);
  const quote = await quoteService.updateQuote(id, validatedData);
  return res.json(quote);
};

// 5) Delete (draft only)
export const deleteQuote = async (req: Request, res: Response) => {
  const id = quoteIdSchema.parse(req.params.id);
  await quoteService.deleteQuote(id);
  return res.status(204).send();
};

// 6) add item
export const addQuoteItem = async (req: Request, res: Response) => {
  const quoteId = quoteIdSchema.parse(req.params.id);
  const validatedData = createQuoteItemSchema.parse(req.body);
  const quote = await quoteService.addQuoteItem(quoteId, validatedData);
  return res.status(201).json(quote);
};

// 7) update item
export const updateQuoteItem = async (req: Request, res: Response) => {
  const quoteId = quoteIdSchema.parse(req.params.id);
  const itemId = quoteItemIdSchema.parse(req.params.itemId);
  const validatedData = updateQuoteItemSchema.parse(req.body);
  const quote = await quoteService.updateQuoteItem(quoteId, itemId, validatedData);
  return res.json(quote);
};

// 8) delete item
export const deleteQuoteItem = async (req: Request, res: Response) => {
  const quoteId = quoteIdSchema.parse(req.params.id);
  const itemId = quoteItemIdSchema.parse(req.params.itemId);
  const quote = await quoteService.deleteQuoteItem(quoteId, itemId);
  return res.json(quote);
};

// 9) send quote
export const sendQuote = async (req: Request, res: Response) => {
  const id = quoteIdSchema.parse(req.params.id);
  const quote = await quoteService.sendQuote(id);
  return res.json(quote);
};

// 10) Approve quote
export const approveQuote = async (req: Request, res: Response) => {
  const id = quoteIdSchema.parse(req.params.id);
  const validatedData = approveQuoteSchema.parse(req.body);
  const quote = await quoteService.approveQuote(id, validatedData);
  return res.json(quote);
};

// 11) Reject quote
export const rejectQuote = async (req: Request, res: Response) => {
  const id = quoteIdSchema.parse(req.params.id);
  const validatedData = rejectQuoteSchema.parse(req.body);
  const quote = await quoteService.rejectQuote(id, validatedData);
  return res.json(quote);
};
