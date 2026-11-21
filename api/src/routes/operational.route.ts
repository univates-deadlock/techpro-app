import { Router } from "express";
import * as controller from "../controllers/operational.controller.js";
import { requireActiveUser } from "../middlewares/requireActiveUser.js";
import { requireRole } from "../middlewares/requireRole.js";

const router = Router();
router.use(requireActiveUser, requireRole("ADMIN", "PLANNING"));
router.get("/alerts", controller.alerts);
router.get("/dashboard", controller.dashboard);
export default router;
