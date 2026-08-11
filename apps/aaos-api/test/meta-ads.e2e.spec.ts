import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { mswServer, registerHappyPathMetaApiHandlers } from "../src/test-support/meta-api-msw.js";

import { bootstrapTestApp } from "./helpers/bootstrap.js";

const API_KEY = "test-api-key";

describe("meta-ads e2e — GET /api/v1/campaigns, POST /api/v1/verdicts", () => {
  let app: NestFastifyApplication;

  // "bypass" (not "error"): this e2e suite makes real HTTP calls to the local supertest server
  // in addition to the MSW-mocked Meta Graph API calls the app itself issues — only the latter
  // have registered handlers, so unmatched local traffic must pass through untouched.
  beforeAll(async () => {
    mswServer.listen({ onUnhandledRequest: "bypass" });
    app = await bootstrapTestApp();
  });
  afterEach(() => mswServer.resetHandlers());
  afterAll(async () => {
    mswServer.close();
    await app.close();
  });

  it("GET /api/v1/campaigns -> 200 with an MSW-mocked Meta API, real AdAccount JSON", async () => {
    registerHappyPathMetaApiHandlers();
    const response = await request(app.getHttpServer())
      .get("/api/v1/campaigns")
      .set("x-api-key", API_KEY);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe("act_752604553578354");
    expect(response.body.campaigns).toHaveLength(1);
    expect(response.body.campaigns[0].adSets[0].ads[0]).toHaveProperty("verdict");
  });

  it("GET /api/v1/campaigns with an invalid adAccountId query -> 422", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/campaigns?adAccountId=not-valid")
      .set("x-api-key", API_KEY);

    expect(response.status).toBe(422);
    expect(response.body.error).toBe("ValidationError");
  });

  it("GET /api/v1/campaigns with an unsupported datePreset -> 422", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/campaigns?datePreset=last_year")
      .set("x-api-key", API_KEY);

    expect(response.status).toBe(422);
  });

  it("GET /api/v1/campaigns with a wrong x-api-key -> 401", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/campaigns")
      .set("x-api-key", "wrong-key");

    expect(response.status).toBe(401);
  });

  it("POST /api/v1/verdicts PAUSE -> 200 with the connector's ExecutionResult", async () => {
    registerHappyPathMetaApiHandlers();
    const response = await request(app.getHttpServer())
      .post("/api/v1/verdicts")
      .set("x-api-key", API_KEY)
      .send({ verdict: "PAUSE", targetId: "120000000000003", targetType: "ad" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ action: "PAUSED", targetId: "120000000000003" });
  });

  it("POST /api/v1/verdicts with an invalid body -> 422", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/verdicts")
      .set("x-api-key", API_KEY)
      .send({ verdict: "NOT_A_VERDICT", targetId: "id", targetType: "ad" });

    expect(response.status).toBe(422);
    expect(response.body.error).toBe("ValidationError");
  });

  it("POST /api/v1/verdicts without x-api-key -> 401", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/verdicts")
      .send({ verdict: "PAUSE", targetId: "id", targetType: "ad" });

    expect(response.status).toBe(401);
  });
});
