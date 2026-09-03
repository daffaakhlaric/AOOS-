import { afterEach, describe, expect, it, vi } from "vitest";

import { reportSimulationBatchToLearningSystem } from "@/lib/learning-bridge";

import { buildAllScenariosReport, buildJudgementResult } from "../fixtures";

describe("reportSimulationBatchToLearningSystem", () => {
  const originalBaseUrl = process.env["AAOS_API_BASE_URL"];
  const originalApiKey = process.env["AAOS_API_KEY"];
  const originalTenantId = process.env["AAOS_SIMULATOR_TENANT_ID"];

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const [key, original] of [
      ["AAOS_API_BASE_URL", originalBaseUrl],
      ["AAOS_API_KEY", originalApiKey],
      ["AAOS_SIMULATOR_TENANT_ID", originalTenantId],
    ] as const) {
      if (original === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original;
      }
    }
  });

  it("returns SKIPPED (never throws) when AAOS_API_BASE_URL is not configured", async () => {
    delete process.env["AAOS_API_BASE_URL"];
    process.env["AAOS_API_KEY"] = "test-key";
    const result = await reportSimulationBatchToLearningSystem(buildAllScenariosReport());
    expect(result.status).toBe("SKIPPED");
  });

  it("returns SKIPPED when AAOS_API_KEY is not configured", async () => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    delete process.env["AAOS_API_KEY"];
    const result = await reportSimulationBatchToLearningSystem(buildAllScenariosReport());
    expect(result.status).toBe("SKIPPED");
  });

  it("posts the real report to POST /api/v1/ai-judge/simulation-batch with x-api-key, and returns SENT on 2xx", async () => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
    delete process.env["AAOS_SIMULATOR_TENANT_ID"];

    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ agentRunId: "run-1", judgeResultId: "judge-1" }), {
          status: 201,
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const report = buildAllScenariosReport({ results: [buildJudgementResult()] });
    const result = await reportSimulationBatchToLearningSystem(report);

    expect(result).toEqual({ status: "SENT", agentRunId: "run-1", judgeResultId: "judge-1" });

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe("/api/v1/ai-judge/simulation-batch");
    const headers = init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("test-key");
    expect(headers["x-tenant-id"]).toBeUndefined();

    const body = JSON.parse(init.body as string) as { results: unknown[]; avgOverallScore: number };
    expect(body.avgOverallScore).toBe(report.avgOverallScore);
    expect(body.results).toHaveLength(1);
  });

  it("sends x-tenant-id only when AAOS_SIMULATOR_TENANT_ID is explicitly configured", async () => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
    process.env["AAOS_SIMULATOR_TENANT_ID"] = "another-tenant";

    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ agentRunId: "run-1", judgeResultId: "judge-1" }), {
          status: 201,
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await reportSimulationBatchToLearningSystem(buildAllScenariosReport());

    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect((init.headers as Record<string, string>)["x-tenant-id"]).toBe("another-tenant");
  });

  it("returns FAILED (never throws) on a non-2xx response", async () => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ message: "invalid body" }), { status: 422 })),
    );

    const result = await reportSimulationBatchToLearningSystem(buildAllScenariosReport());
    expect(result).toEqual({ status: "FAILED", reason: "invalid body" });
  });

  it("returns FAILED (never throws) on a network failure", async () => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    const result = await reportSimulationBatchToLearningSystem(buildAllScenariosReport());
    expect(result.status).toBe("FAILED");
  });

  it("returns FAILED when the 2xx response body is not the expected shape", async () => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({}), { status: 201 })),
    );

    const result = await reportSimulationBatchToLearningSystem(buildAllScenariosReport());
    expect(result.status).toBe("FAILED");
  });
});
