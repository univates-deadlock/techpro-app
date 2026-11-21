import { Router, raw } from "express";
import * as QuoteController from "../controllers/quote.controller.js";
import * as EvidenceController from "../controllers/quote-evidence.controller.js";
import { requireActiveUser } from "../middlewares/requireActiveUser.js";
import { requireRole } from "../middlewares/requireRole.js";

const router = Router();

// Requires the user to be authenticated and active in the system to access any quote route
router.use(requireActiveUser);

// Requires the user role == ADMIN or PLANNING
router.use(requireRole("ADMIN", "PLANNING"));

router.get("/", QuoteController.getAllQuotes);
router.post("/", QuoteController.createQuote);
router.get("/:id", QuoteController.getQuoteById);
router.patch("/:id", QuoteController.updateQuote);
router.delete("/:id", QuoteController.deleteQuote);

// Optional evidence is available only after approval; never exposed as public static files.
router.post("/:id/evidence", raw({ type: ["application/pdf", "image/png", "image/jpeg"], limit: "10mb" }), EvidenceController.upload);
router.get("/:id/evidence/:filename", EvidenceController.download);

//Quote items
router.post("/:id/items", QuoteController.addQuoteItem);
router.patch("/:id/items/:itemId", QuoteController.updateQuoteItem);
router.delete("/:id/items/:itemId", QuoteController.deleteQuoteItem);

export default router;