import { Router } from "express";
import * as ServiceController from "../controllers/service.controller.js";
import { requireActiveUser } from "../middlewares/requireActiveUser.js";
import { requireRole } from "../middlewares/requireRole.js";

const router = Router();

// Requires the user to be authenticated and active in the system to access any service route
router.use(requireActiveUser);

// Requires the user role == ADMIN or PLANNING
router.use(requireRole("ADMIN", "PLANNING"));

router.get("/", ServiceController.getAllServices);
router.post("/", ServiceController.createService);
router.get("/:id", ServiceController.getServiceById);
router.patch("/:id", ServiceController.updateService);
router.patch("/:id/status", ServiceController.updateServiceStatus);

export default router;