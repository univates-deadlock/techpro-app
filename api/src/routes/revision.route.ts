import { Router } from "express";
import * as controller from "../controllers/revision.controller.js";
import { requireActiveUser } from "../middlewares/requireActiveUser.js";
import { requireRole } from "../middlewares/requireRole.js";

const router = Router();
router.use(requireActiveUser, requireRole("ADMIN", "PLANNING"));
router.get("/", controller.list);
router.post("/", controller.create);
router.get("/:id", controller.detail);
router.patch("/:id", controller.update);
router.delete("/:id", controller.remove);
export default router;
