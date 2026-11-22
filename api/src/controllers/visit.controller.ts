import type { Request, Response } from "express";
import { serviceIdSchema } from "../schemas/service.schema.js";
import {
  createVisitSchema,
  listVisitsQuerySchema,
  setVisitTechniciansSchema,
  updateVisitSchema,
  visitIdSchema,
} from "../schemas/visit.schema.js";
import * as visitService from "../services/visit.service.js";
import type { VisitConflict } from "../services/visit.service.js";

// A technician time conflict is not an error of the request itself: nothing was saved
// and the client can repeat it with confirmConflicts: true to confirm.
const respondWithConflicts = (res: Response, conflicts: VisitConflict[]) =>
  res.status(409).json({
    error: "Há conflito de horário para técnicos desta visita",
    conflicts,
    confirmation: "Para agendar mesmo assim, reenvie a requisição com confirmConflicts: true",
  });

// 1) list All (filters: serviceId, technicianId, status, from, to)
export const getAllVisits = async (req: Request, res: Response) => {
  const filters = listVisitsQuerySchema.parse(req.query);
  const visits = await visitService.getAllVisits(filters);
  return res.json(visits);
};

// 2) create visit for a service, optionally with technicians (route: POST /services/:id/visits)
export const createVisit = async (req: Request, res: Response) => {
  const serviceId = serviceIdSchema.parse(req.params.id);
  const validatedData = createVisitSchema.parse(req.body);
  const result = await visitService.createVisit(serviceId, validatedData);

  if (!result.ok) {
    return respondWithConflicts(res, result.conflicts);
  }

  return res.status(201).json(result.visit);
};

// 3) list visits of a service (route: GET /services/:id/visits)
export const getVisitsByService = async (req: Request, res: Response) => {
  const serviceId = serviceIdSchema.parse(req.params.id);
  const visits = await visitService.getVisitsByService(serviceId);
  return res.json(visits);
};

// 4) search visit by id
export const getVisitById = async (req: Request, res: Response) => {
  const id = visitIdSchema.parse(req.params.id);
  const visit = await visitService.getVisitById(id);
  return res.json(visit);
};

// 5) update / reschedule visit
export const updateVisit = async (req: Request, res: Response) => {
  const id = visitIdSchema.parse(req.params.id);
  const validatedData = updateVisitSchema.parse(req.body);
  const result = await visitService.updateVisit(id, validatedData);

  if (!result.ok) {
    return respondWithConflicts(res, result.conflicts);
  }

  return res.json(result.visit);
};

// 6) assign / unassign technicians (replaces the whole list)
export const setVisitTechnicians = async (req: Request, res: Response) => {
  const id = visitIdSchema.parse(req.params.id);
  const validatedData = setVisitTechniciansSchema.parse(req.body);
  const result = await visitService.setVisitTechnicians(id, validatedData);

  if (!result.ok) {
    return respondWithConflicts(res, result.conflicts);
  }

  return res.json(result.visit);
};