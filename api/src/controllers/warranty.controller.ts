import type { Request, Response } from "express";
import {
  createWarrantySchema, listWarrantiesSchema, updateWarrantySchema, warrantyIdSchema,
} from "../schemas/warranty.schema.js";
import * as warrantyService from "../services/warranty.service.js";

export const list = async (req: Request, res: Response) =>
  res.json(await warrantyService.listWarranties(listWarrantiesSchema.parse(req.query)));

export const detail = async (req: Request, res: Response) =>
  res.json(await warrantyService.getWarranty(warrantyIdSchema.parse(req.params.id)));

export const create = async (req: Request, res: Response) =>
  res.status(201).json(await warrantyService.createWarranty(createWarrantySchema.parse(req.body)));

export const update = async (req: Request, res: Response) =>
  res.json(await warrantyService.updateWarranty(
    warrantyIdSchema.parse(req.params.id), updateWarrantySchema.parse(req.body),
  ));

export const remove = async (req: Request, res: Response) => {
  await warrantyService.deleteWarranty(warrantyIdSchema.parse(req.params.id));
  return res.status(204).send();
};
