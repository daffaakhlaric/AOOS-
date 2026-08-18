import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ScraperService } from "../src/modules/scraper/scraper.service.js";

import { bootstrapTestApp } from "./helpers/bootstrap.js";

const API_KEY = "test-api-key";

/**
 * e2e coverage for the new `scraper`/`assets` modules (AAOS-SCRAPER-ASSET-LIBRARY) over a real HTTP
 * socket against the real composed `AppModule`.
 *
 * The test config deliberately leaves `GCS_*` empty (see `buildTestConfig`), so this exercises the
 * REAL "not configured" degradation path end to end: the app must still boot and route every one of
 * these endpoints — that graceful degradation is the whole point of composing `@aos/asset-library`
 * conditionally. No real GCS, Supabase or mobixbydss.id request is made by any test here (the
 * Supabase client is only constructed, never successfully called, against a fake project URL).
 */
describe("scraper + assets e2e", () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await bootstrapTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("auth", () => {
    it.each([
      ["get", "/api/v1/scraper/status"],
      ["get", "/api/v1/scraper/stock"],
      ["get", "/api/v1/scraper/jobs"],
      ["post", "/api/v1/scraper/run"],
      ["get", "/api/v1/assets"],
      ["get", "/api/v1/assets/stats"],
    ] as const)("%s %s without x-api-key -> 401", async (method, path) => {
      const response =
        method === "get"
          ? await request(app.getHttpServer()).get(path)
          : await request(app.getHttpServer()).post(path).send({});
      expect(response.status).toBe(401);
    });

    it("the SSE stream route is guarded too (which is exactly why the dashboard must proxy it — EventSource cannot set headers)", async () => {
      const response = await request(app.getHttpServer()).get("/api/v1/scraper/jobs/job-1/stream");
      expect(response.status).toBe(401);
    });
  });

  describe("assets — real GCS-not-configured degradation", () => {
    it("GET /api/v1/assets -> 503 with a message naming the missing env vars", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/assets")
        .set("x-api-key", API_KEY);
      expect(response.status).toBe(503);
      expect(response.body.message).toContain("GCS_PROJECT_ID");
      // Never an empty-but-successful list, which would be indistinguishable from "no assets yet".
      expect(response.body).not.toHaveProperty("assets");
    });

    it("GET /api/v1/assets/stats -> 503", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/assets/stats")
        .set("x-api-key", API_KEY);
      expect(response.status).toBe(503);
    });

    it("DELETE /api/v1/assets/:id -> 503 (and never attempts a destructive operation)", async () => {
      const response = await request(app.getHttpServer())
        .delete("/api/v1/assets/asset-1")
        .set("x-api-key", API_KEY);
      expect(response.status).toBe(503);
    });
  });

  describe("assets — query validation at the HTTP boundary", () => {
    it("rejects a fabricated ?type=ALL with 422 before any I/O", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/assets?type=ALL")
        .set("x-api-key", API_KEY);
      expect(response.status).toBe(422);
      expect(response.body.error).toBe("ValidationError");
    });

    it("rejects ?status=REJECTED (not a real AssetStatus) with 422", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/assets?status=REJECTED")
        .set("x-api-key", API_KEY);
      expect(response.status).toBe(422);
    });

    it("rejects an over-cap ?limit=500 with 422", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/assets?limit=500")
        .set("x-api-key", API_KEY);
      expect(response.status).toBe(422);
    });
  });

  describe("scraper — request validation", () => {
    it("POST /api/v1/scraper/run rejects a non-URL unitUrl with 422", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/scraper/run")
        .set("x-api-key", API_KEY)
        .send({ unitUrl: "not-a-url" });
      expect(response.status).toBe(422);
    });

    it("GET /api/v1/scraper/stock rejects a fabricated branch with 422", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/scraper/stock?branch=PONDOK_BAMBU")
        .set("x-api-key", API_KEY);
      expect(response.status).toBe(422);
    });
  });

  /**
   * The load-bearing test for coordinator note #6: NestJS's `@Sse()` is brand new to this codebase
   * and this app runs on `@nestjs/platform-fastify`. This proves the combination actually works over
   * a real socket — the response is a `text/event-stream` carrying real `data:` frames — rather than
   * assuming it from the framework docs.
   *
   * The job state is stubbed at the SERVICE level (not the DB) so the test needs no Supabase: the
   * transport is what's under test here, and the persistence path has its own repository/service
   * specs.
   */
  describe("@Sse() progress stream over a real Fastify socket", () => {
    it("streams text/event-stream data frames and closes when the job leaves RUNNING", async () => {
      const service = app.get(ScraperService);
      const snapshots = [
        {
          id: "job-1",
          kind: "FULL",
          status: "RUNNING",
          progressCurrent: 1,
          progressTotal: 2,
          logs: [],
          createdAt: "t",
          updatedAt: "t",
        },
        {
          id: "job-1",
          kind: "FULL",
          status: "DONE",
          progressCurrent: 2,
          progressTotal: 2,
          logs: [],
          createdAt: "t",
          updatedAt: "t",
        },
      ];
      let index = 0;
      const original = service.getJob.bind(service);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deliberate targeted stub of one method on the real DI-resolved service; see this block's doc comment.
      (service as any).getJob = async () => snapshots[Math.min(index++, snapshots.length - 1)];

      try {
        const response = await request(app.getHttpServer())
          .get("/api/v1/scraper/jobs/job-1/stream")
          .set("x-api-key", API_KEY)
          .buffer(true)
          .parse((res, callback) => {
            let raw = "";
            res.on("data", (chunk: Buffer) => {
              raw += chunk.toString();
            });
            res.on("end", () => callback(null, raw));
          });

        expect(response.status).toBe(200);
        expect(String(response.headers["content-type"])).toContain("text/event-stream");

        const body = String(response.body);
        expect(body).toContain("data:");
        expect(body).toContain('"status":"RUNNING"');
        // The FINAL non-RUNNING snapshot is delivered before the stream closes — the inclusive
        // `takeWhile` in the controller is what guarantees the client sees the terminal state.
        expect(body).toContain('"status":"DONE"');
      } finally {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- restores the real method.
        (service as any).getJob = original;
      }
    }, 20_000);
  });
});
