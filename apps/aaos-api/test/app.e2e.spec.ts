import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bootstrapTestApp } from "./helpers/bootstrap.js";

describe("app e2e — health, readiness, cross-cutting concerns", () => {
  let app: NestFastifyApplication;

  // One app instance for the whole file (not per-test): each test issues its own independent
  // request against it, and this avoids rapid create/destroy cycles of the underlying Fastify
  // HTTP server across many tests in the same process.
  beforeAll(async () => {
    app = await bootstrapTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /health -> 200 { status: ok, version, timestamp }", async () => {
    const response = await request(app.getHttpServer()).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "ok", version: "0.1.0" });
    expect(typeof response.body.timestamp).toBe("string");
  });

  it("GET /ready -> 200 { status: ready, checks: {...} }", async () => {
    const response = await request(app.getHttpServer()).get("/ready");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ready",
      checks: { config: true, metaAdsConnector: true },
    });
  });

  it("an unknown route -> 404 via AaosExceptionFilter's consistent error shape", async () => {
    const response = await request(app.getHttpServer()).get("/this-route-does-not-exist");
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ statusCode: 404 });
    expect(response.body.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(typeof response.body.timestamp).toBe("string");
  });

  it("echoes back a caller-supplied x-correlation-id on an error response", async () => {
    const response = await request(app.getHttpServer())
      .get("/this-route-does-not-exist")
      .set("x-correlation-id", "caller-supplied-id");
    expect(response.body.correlationId).toBe("caller-supplied-id");
  });

  it("GET /api/v1/campaigns without x-api-key -> 401", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1/campaigns");
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ statusCode: 401, error: "UnauthorizedException" });
  });
});
