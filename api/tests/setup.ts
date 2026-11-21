import { join } from "node:path";
import { tmpdir } from "node:os";
import { inject } from "vitest";

// Override local configuration before any application module opens a connection.
process.env.DATABASE_URL = inject("testDatabaseUrl");
process.env.BETTER_AUTH_SECRET = "test-only-better-auth-secret-for-api-tests";
process.env.BETTER_AUTH_URL = "http://localhost:4000";
process.env.FE_BASE_URL = "http://localhost:3000";
process.env.PORT = "4000";

process.env.EVIDENCE_DIR = join(tmpdir(), "techpro-evidence-tests-" + process.pid);
