import type { Request, Response } from "express";
import {
  createServiceSchema,
  listServicesQuerySchema,
  serviceIdSchema,
  updateServiceSchema,
  updateServiceStatusSchema,
} from "../schemas/service.schema.js";
import * as serviceService from "../services/service.service.js";
import { getAuthenticatedUserId } from "../utils/authUser.js";

// 1) list All (filters: clientId, status, origin, q, from, to)
export const getAllServices = async (req: Request, res: Response) => {
  const filters = listServicesQuerySchema.parse(req.query);
  const services = await serviceService.getAllServices(filters);
  return res.json(services);
};

// 2) search by id
export const getServiceById = async (req: Request, res: Response) => {
  const id = serviceIdSchema.parse(req.params.id);
  const service = await serviceService.getServiceById(id);
  return res.json(service);
};

// 3) create new (from approved quote or direct)
export const createService = async (req: Request, res: Response) => {
  const validatedData = createServiceSchema.parse(req.body);
  const service = await serviceService.createService(validatedData, getAuthenticatedUserId(res));
  return res.status(201).json(service);
};

// 4) update
export const updateService = async (req: Request, res: Response) => {
  const id = serviceIdSchema.parse(req.params.id);
  const validatedData = updateServiceSchema.parse(req.body);
  const service = await serviceService.updateService(id, validatedData);
  return res.json(service);
};

// 5) update status
export const updateServiceStatus = async (req: Request, res: Response) => {
  const id = serviceIdSchema.parse(req.params.id);
  const { status } = updateServiceStatusSchema.parse(req.body);
  const service = await serviceService.updateServiceStatus(id, status);
  return res.json(service);
};