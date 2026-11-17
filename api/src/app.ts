import express, { json } from "express";
import "dotenv/config";

// Better Auth
import { toNodeHandler } from "better-auth/node";
import { auth } from "./utils/auth.js";

// Utils
import helmet from "helmet";
import cors from "./utils/cors.js";
import rateLimit from "./utils/rateLimit.js";
import { globalErrorHandler } from "./middlewares/ErrorHandler.js";

// Routes Import
import healthRoute from "./routes/health.route.js";
import userRoute from "./routes/user.route.js";
import clientRoute from "./routes/client.route.js";
import quoteRoute from "./routes/quote.route.js";
import serviceRoute from "./routes/service.route.js";  

// Creates App
const app = express();

// Initial Utils
app.use(cors);
app.use(helmet());

// Better auth
app.use(rateLimit);
app.all("/api/auth/*splat", toNodeHandler(auth));

// Rest of Utils
app.use(json({ limit: "100kb" }));

// Routes Use
app.use('/api/health', healthRoute);
app.use('/api/users', userRoute);
app.use('/api/clients', clientRoute);
app.use('/api/quotes', quoteRoute);
app.use('/api/services', serviceRoute);  

// Global Error Handler
app.use(globalErrorHandler);

export default app;
