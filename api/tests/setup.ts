import { inject } from "vitest";

// Configure isolated services before importing the Express application.
process.env.DATABASE_URL = inject("testDatabaseUrl");
process.env.S3_ENDPOINT = inject("testStorageUrl");
process.env.S3_REGION = "us-east-1";
process.env.S3_BUCKET = "techpro-evidences";
process.env.S3_ACCESS_KEY_ID = "techpro-test";
process.env.S3_SECRET_ACCESS_KEY = "techpro-test-secret";
process.env.BETTER_AUTH_SECRET = "test-only-better-auth-secret-for-api-tests";
process.env.BETTER_AUTH_URL = "http://localhost:4000";
process.env.FE_BASE_URL = "http://localhost:3000";
process.env.PORT = "4000";
