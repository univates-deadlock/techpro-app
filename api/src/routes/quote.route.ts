import { Router } from "express";
import * as QuoteController from "../controllers/quote.controller.js";
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
router.post("/:id/send", QuoteController.sendQuote);
router.post("/:id/approve", QuoteController.approveQuote);
router.post("/:id/reject", QuoteController.rejectQuote);

//Quote items
router.post("/:id/items", QuoteController.addQuoteItem);
router.patch("/:id/items/:itemId", QuoteController.updateQuoteItem);
router.delete("/:id/items/:itemId", QuoteController.deleteQuoteItem);

export default router;