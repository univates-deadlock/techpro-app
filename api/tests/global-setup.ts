import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  interface ProvidedContext {
    testDatabaseUrl: string;
    testStorageUrl: string;
  }
}

export default async function setup(project: TestProject) {
  const suffix = randomUUID();
  const dbContainer = "techpro-db-test-" + suffix;
  const s3Container = "techpro-s3-test-" + suffix;
  const password = randomUUID();
  const started: string[] = [];

  const docker = (...args: string[]) =>
    execFileSync("docker", args, { encoding: "utf8", timeout: 240_000 });

  try {
    docker("info");
  } catch {
    throw new Error("Integration tests require a working Docker daemon");
  }

  const cleanup = () => {
    for (const name of started.reverse()) {
      try {
        docker("rm", "--force", name);
      } catch {
        // Container may already be removed.
      }
    }
    started.length = 0;
  };

  process.once("SIGINT", cleanup);
  process.once("SIGTERM", cleanup);

  try {
    docker(
      "run", "--rm", "--detach", "--name", dbContainer,
      "--env", "POSTGRES_PASSWORD=" + password,
      "--env", "POSTGRES_DB=api_test",
      "--publish", "127.0.0.1::5432", "postgres:17-alpine",
    );
    started.push(dbContainer);

    const dbDeadline = Date.now() + 30_000;
    while (true) {
      try {
        docker("exec", dbContainer, "pg_isready", "--host=127.0.0.1", "--username=postgres", "--dbname=api_test");
        break;
      } catch {
        if (Date.now() >= dbDeadline) {
          throw new Error("Disposable PostgreSQL did not become ready");
        }
        await setTimeout(200);
      }
    }

    const dbPort = docker("port", dbContainer, "5432/tcp")
      .trim().match(/^127\.0\.0\.1:(\d+)$/)?.[1];
    if (!dbPort) throw new Error("Could not determine disposable PostgreSQL port");

    const databaseUrl = "postgresql://postgres:" + password + "@127.0.0.1:" + dbPort + "/api_test";
    const apiDirectory = fileURLToPath(new URL("../", import.meta.url));

    execFileSync(
      process.execPath,
      [fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url)), "migrate", "deploy"],
      {
        cwd: apiDirectory,
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: "pipe",
        timeout: 60_000,
      },
    );

    docker(
      "run", "--rm", "--detach", "--name", s3Container,
      "--env", "RUSTFS_ACCESS_KEY=techpro-test",
      "--env", "RUSTFS_SECRET_KEY=techpro-test-secret",
      "--env", "RUSTFS_CONSOLE_ENABLE=false",
      "--env", "RUSTFS_VOLUMES=/data",
      "--publish", "127.0.0.1::9000", "rustfs/rustfs:1.0.4",
    );
    started.push(s3Container);

    const s3Port = docker("port", s3Container, "9000/tcp")
      .trim().match(/^127\.0\.0\.1:(\d+)$/)?.[1];
    if (!s3Port) throw new Error("Could not determine disposable S3 port");
    const storageUrl = "http://127.0.0.1:" + s3Port;
    const s3Deadline = Date.now() + 60_000;
    while (true) {
      try {
        const response = await fetch(storageUrl + "/health", {
          signal: AbortSignal.timeout(2500),
        });
        if (response.ok) break;
      } catch {
        // RustFS is still initializing.
      }
      if (Date.now() >= s3Deadline) {
        throw new Error("Disposable RustFS did not become ready");
      }
      await setTimeout(500);
    }

    project.provide("testDatabaseUrl", databaseUrl);
    project.provide("testStorageUrl", storageUrl);
    return () => {
      process.removeListener("SIGINT", cleanup);
      process.removeListener("SIGTERM", cleanup);
      cleanup();
    };
  } catch (error) {
    cleanup();
    throw error;
  }
}
