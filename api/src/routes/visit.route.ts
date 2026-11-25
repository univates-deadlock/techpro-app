import { Router } from "express";
import * as VisitController from "../controllers/visit.controller.js";
import { requireActiveUser } from "../middlewares/requireActiveUser.js";
import { requireRole } from "../middlewares/requireRole.js";

const router = Router();

// Requires the user to be authenticated and active in the system to access any visit route
router.use(requireActiveUser);

// Scheduling and technician assignment are for ADMIN and PLANNING (UC05). The role is
// set per route so routes for other profiles can be added to this module later.
router.get("/", requireRole("ADMIN", "PLANNING", "TECHNICIAN"), VisitController.getAllVisits);
router.get("/technicians", requireRole("ADMIN", "PLANNING"), VisitController.listTechnicians);
router.patch("/:id/execution", requireRole("ADMIN", "PLANNING", "TECHNICIAN"), VisitController.executeVisit);
router.patch("/:id/status", requireRole("ADMIN", "PLANNING"), VisitController.cancelVisit);
router.get("/:id", requireRole("ADMIN", "PLANNING"), VisitController.getVisitById);
router.patch("/:id", requireRole("ADMIN", "PLANNING"), VisitController.updateVisit);
router.put(
  "/:id/technicians",
  requireRole("ADMIN", "PLANNING"),
  VisitController.setVisitTechnicians
);

export default router;