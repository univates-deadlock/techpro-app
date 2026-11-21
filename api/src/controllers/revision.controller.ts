import type { Request, Response } from "express";
import {
  createRevisionSchema, listRevisionsSchema, revisionIdSchema, updateRevisionSchema,
} from "../schemas/revision.schema.js";
import * as revisionService from "../services/revision.service.js";

export const list = async (req: Request, res: Response) =>
  res.json(await revisionService.listRevisions(listRevisionsSchema.parse(req.query)));

export const detail = async (req: Request, res: Response) =>
  res.json(await revisionService.getRevision(revisionIdSchema.parse(req.params.id)));

export const create = async (req: Request, res: Response) =>
  res.status(201).json(await revisionService.createRevision(createRevisionSchema.parse(req.body)));

export const update = async (req: Request, res: Response) =>
  res.json(await revisionService.updateRevision(
    revisionIdSchema.parse(req.params.id), updateRevisionSchema.parse(req.body),
  ));

export const remove = async (req: Request, res: Response) => {
  await revisionService.deleteRevision(revisionIdSchema.parse(req.params.id));
  return res.status(204).send();
};
