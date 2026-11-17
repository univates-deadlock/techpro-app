import type { Response } from "express";
import { AppError } from "./AppError.js";

// The requireActiveUser middleware stores the authenticated user in res.locals.user.
export const getAuthenticatedUserId = (res: Response): string => {
  const user = res.locals.user as { id?: string } | undefined;

  if (!user?.id) {
    throw new AppError("Usuário não autenticado", 401);
  }

  return user.id;
};