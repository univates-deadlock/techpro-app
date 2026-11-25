import cors from 'cors';
import { env } from '../config/env.js';

const cors_options = {
    origin: env.FE_BASE_URL,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204
};

export default cors(cors_options);
