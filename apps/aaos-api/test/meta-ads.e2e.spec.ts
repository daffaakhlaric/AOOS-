import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  mswServer,
  registerCreateCampaignMswHandlers,
  registerHappyPathMetaApiHandlers,
} from "../src/test-support/meta-api-msw.js";

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

  // AAOS-SETTINGS-WEBHOOK-CONFIG (Part B) — this is the FIRST request in this describe block to
  // resolve `MetaAdsConnectorRegistry` for `dss-motor`, which (correctly, per Part B's DB-first
  // fix) attempts a REAL `tenants` lookup before falling back to `.env`. In THIS sandboxed test
  // environment the fake `SUPABASE_URL` fixture has no real DNS record, and Node's `fetch` takes
  // several real seconds (verified directly: ~7s) to report the resolution failure — a one-time
  // cost paid once per bootstrapped test app (the registry then caches the static fallback, per
  // its own doc — every OTHER test below this one is unaffected), never a production concern.
  // Bumped past the default 5000ms so this test measures real behavior, not sandbox DNS latency.
  it("GET /api/v1/campaigns -> 200 with an MSW-mocked Meta API, real AdAccount JSON", async () => {
    registerHappyPathMetaApiHandlers();
    const response = await request(app.getHttpServer())
      .get("/api/v1/campaigns")
      .set("x-api-key", API_KEY);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe("act_752604553578354");
    expect(response.body.campaigns).toHaveLength(1);
    expect(response.body.campaigns[0].adSets[0].ads[0]).toHaveProperty("verdict");
  }, 15000);

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

  // Same sandbox-DNS-latency rationale as the GET /api/v1/campaigns test above — bumped as a
  // defensive measure in case test execution order/timing means this one hits the (per-app-instance,
  // one-time, then-cached) MetaAdsConnectorRegistry resolution before it's warm.
  //
  // AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase B: `MetaAdsService.executeVerdict` now ALSO calls
  // `ModeGuardService.resolveMode` (deliberately uncached, per that service's own doc — a real
  // `TenantRepository` read on every call, not just the first) AND `ActivityLogger.start`/
  // `.complete` (2 more real `agent_activities` Supabase calls, best-effort/never-throwing but
  // NOT faster to fail in this sandbox) — 3 more real network round trips on top of the
  // connector registry's own, each paying the same ~7s sandbox DNS-failure cost this file's own
  // comment already documents. Bumped further (was 15000) so this test measures real behavior,
  // not sandbox network latency compounding across every real Supabase-backed call this endpoint
  // now makes.
  it("POST /api/v1/verdicts PAUSE -> 200 with the connector's ExecutionResult", async () => {
    registerHappyPathMetaApiHandlers();
    const response = await request(app.getHttpServer())
      .post("/api/v1/verdicts")
      .set("x-api-key", API_KEY)
      .send({ verdict: "PAUSE", targetId: "120000000000003", targetType: "ad" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ action: "PAUSED", targetId: "120000000000003" });
  }, 40000);

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

describe("campaigns e2e — POST /api/v1/campaigns/create (AAOS-W1D-S3)", () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    mswServer.listen({ onUnhandledRequest: "bypass" });
    app = await bootstrapTestApp();
  });
  afterEach(() => mswServer.resetHandlers());
  afterAll(async () => {
    mswServer.close();
    await app.close();
  });

  // Same sandbox-DNS-latency rationale as meta-ads e2e's GET /api/v1/campaigns test above — this
  // describe block bootstraps its OWN app instance, so it independently pays the one-time,
  // then-cached MetaAdsConnectorRegistry resolution cost for `dss-motor`, PLUS the same
  // uncached-per-call `ModeGuardService.resolveMode` + 2 real `ActivityLogger` Supabase round
  // trips this file's `POST /api/v1/verdicts` test above now documents (AAOS-PROPERTY-DEVLIVE-
  // ACTIVITYLOG Phase B) — bumped from 15000 for the same reason.
  it("POST /api/v1/campaigns/create -> 200 with { campaignId, adSetId, simulated: false }", async () => {
    registerCreateCampaignMswHandlers({
      newCampaignId: "120000000000099",
      newAdSetId: "120000000000100",
    });
    const response = await request(app.getHttpServer())
      .post("/api/v1/campaigns/create")
      .set("x-api-key", API_KEY)
      .send({
        adAccountId: "act_752604553578354",
        name: "Meta-CTWA-Leads-Mobix-Cinere",
        branch: "CINERE",
        funnel: "CTWA",
      });

    expect(response.status).toBe(200);
    // AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase A: no `tenants` row exists for `dss-motor` in this
    // e2e app's real (unseeded) DB, so `ModeGuardService.resolveMode` fails open to LIVE — the
    // real `executeFn` path runs, hence `simulated: false` and real ids from the mocked Meta API.
    expect(response.body).toEqual({
      campaignId: "120000000000099",
      adSetId: "120000000000100",
      simulated: false,
    });
  }, 40000);

  it("POST /api/v1/campaigns/create with an invalid body -> 422", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/campaigns/create")
      .set("x-api-key", API_KEY)
      .send({ adAccountId: "not-an-account", name: "X", branch: "CINERE", funnel: "CTWA" });

    expect(response.status).toBe(422);
    expect(response.body.error).toBe("ValidationError");
  });

  it("POST /api/v1/campaigns/create without x-api-key -> 401", async () => {
    const response = await request(app.getHttpServer()).post("/api/v1/campaigns/create").send({
      adAccountId: "act_752604553578354",
      name: "X",
      branch: "CINERE",
      funnel: "CTWA",
    });

    expect(response.status).toBe(401);
  });
});
