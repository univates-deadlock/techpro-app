import type { Request, Response } from "express";
import { operationalQuerySchema } from "../schemas/operational.schema.js";
import { getAlerts, getDashboard } from "../services/operational.service.js";

export const alerts = async (req: Request, res: Response) => {
  const { days } = operationalQuerySchema.parse(req.query);
  return res.json(await getAlerts(days));
};

export const dashboard = async (req: Request, res: Response) => {
  const { days } = operationalQuerySchema.parse(req.query);
  return res.json(await getDashboard(days));
};
