import "reflect-metadata";

import { NotFoundError } from "@aos/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildTestConfig } from "../../test-support/fixtures.js";
import type { LlmService } from "../llm/llm.service.js";

import type { StoredSimulation } from "./domain/simulation-record.js";
import type { StartSimulationBodyDto } from "./dto/start-simulation.dto.js";
import type * as aaosSimulatorClient from "./infrastructure/aaos-simulator-client.js";
import { AaosSimulatorError, callAaosSimulator } from "./infrastructure/aaos-simulator-client.js";
import type { SimulationRepository } from "./infrastructure/simulation.repository.js";
import { SimulationService } from "./simulation.service.js";

vi.mock("./infrastructure/aaos-simulator-client.js", async () => {
  const actual = await vi.importActual<typeof aaosSimulatorClient>(
    "./infrastructure/aaos-simulator-client.js",
  );
  return { ...actual, callAaosSimulator: vi.fn() };
});

const mockedCallAaosSimulator = vi.mocked(callAaosSimulator);

function buildStored(overrides: Partial<StoredSimulation> = {}): StoredSimulation {
  return {
    id: "sim-1",
    tenantId: "dss-motor",
    objectiveSnapshot: {},
    campaignDataSource: "cache",
    personaIds: ["ready_buyer"],
    status: "RUNNING",
    currentStep: "SETUP",
    createdAt: "2026-08-13T00:00:00.000Z",
    updatedAt: "2026-08-13T00:00:00.000Z",
    ...overrides,
  };
}

function buildFakeRepository(stored: StoredSimulation): SimulationRepository {
  const logs: unknown[] = [];
  return {
    create: vi.fn(async () => stored),
    findById: vi.fn(async (id: string) => (id === stored.id ? stored : undefined)),
    list: vi.fn(async () => [stored]),
    updateStep: vi.fn(async () => undefined),
    complete: vi.fn(async () => undefined),
    fail: vi.fn(async () => undefined),
    recordDecision: vi.fn(async () => undefined),
    appendLog: vi.fn(async (_id: string, entry: unknown) => {
      logs.push(entry);
    }),
    listLogs: vi.fn(async () => logs),
  } as unknown as SimulationRepository;
}

function buildFakeLlmService(overrides: Partial<LlmService> = {}): LlmService {
  return {
    analyze: vi.fn(async () => ({
      available: true,
      temuan: [
        { icon: "🔴", judul: "a", detail: "a" },
        { icon: "🔴", judul: "b", detail: "b" },
      ],
      rekomendasi: [{ aksi: "FIX", target: "t", alasan: "a", estimasi: "e" }],
      ringkasan: "Ringkasan nyata.",
    })),
    creativeBrief: vi.fn(async () => ({
      available: true,
      unit: "Xpander",
      angle: "DP_RINGAN",
      branch: "CINERE",
      primaryMessage: "DP mulai 29 juta",
      tone: "casual",
      formats: ["VIDEO_15S"],
      avoid: [],
      urgency: "HIGH",
    })),
    ...overrides,
  } as unknown as LlmService;
}

const BODY: StartSimulationBodyDto = {
  objective: { targetHotLeads: 10 },
  campaignDataSource: "cache",
  campaigns: [],
  kaiAd: { name: "Xpander", branch: "CINERE" as never },
  kaiBranch: "CINERE" as never,
  personaIds: ["ready_buyer"],
};

describe("SimulationService", () => {
  beforeEach(() => {
    mockedCallAaosSimulator.mockReset();
  });

  it("start persists a RUNNING record and returns its id immediately", async () => {
    const stored = buildStored();
    const repository = buildFakeRepository(stored);
    const service = new SimulationService(buildTestConfig(), repository, buildFakeLlmService());

    const result = await service.start(BODY);
    expect(result).toEqual({ id: "sim-1", status: "RUNNING" });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ personaIds: ["ready_buyer"], campaignDataSource: "cache" }),
    );
  });

  it("runs the full pipeline end-to-end and persists a real computed score (Jessy configured)", async () => {
    const stored = buildStored();
    const repository = buildFakeRepository(stored);
    mockedCallAaosSimulator.mockResolvedValue({
      finalScore: 80,
      finalTemperature: "HOT",
      handoffTriggered: true,
      totalTurns: 6,
      overallScore: 90,
      grade: "A",
      verdict: "APPROVED",
      feedbackItems: [],
    });
    const service = new SimulationService(
      buildTestConfig({ AAOS_SIMULATOR_BASE_URL: "http://localhost:4100" }),
      repository,
      buildFakeLlmService(),
    );

    await service.start(BODY);
    // The pipeline is detached (`void this.runPipeline(...)`) — wait for its microtasks to settle.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(repository.complete).toHaveBeenCalledTimes(1);
    const [, result] = (repository.complete as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      { scoring: { verdict: string } },
    ];
    expect(result.scoring.verdict).toBe("GO");
  });

  it("records Jessy as unavailable (never fabricated) when AAOS_SIMULATOR_BASE_URL is unset", async () => {
    const stored = buildStored();
    const repository = buildFakeRepository(stored);
    const service = new SimulationService(
      buildTestConfig({ AAOS_SIMULATOR_BASE_URL: "" }),
      repository,
      buildFakeLlmService(),
    );

    await service.start(BODY);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockedCallAaosSimulator).not.toHaveBeenCalled();
    const [, result] = (repository.complete as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      { jessy: { available: boolean }; scoring: { verdict: string } },
    ];
    expect(result.jessy.available).toBe(false);
    expect(result.scoring.verdict).toBe("INCOMPLETE");
  });

  it("records a real per-persona failure (not a fabricated success) when aaos-simulator errors", async () => {
    const stored = buildStored();
    const repository = buildFakeRepository(stored);
    mockedCallAaosSimulator.mockRejectedValue(new AaosSimulatorError("upstream down"));
    const service = new SimulationService(
      buildTestConfig({ AAOS_SIMULATOR_BASE_URL: "http://localhost:4100" }),
      repository,
      buildFakeLlmService(),
    );

    await service.start(BODY);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const [, result] = (repository.complete as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      { jessy: { runs: ReadonlyArray<{ ok: boolean; error?: string }> } },
    ];
    expect(result.jessy.runs[0]?.ok).toBe(false);
    expect(result.jessy.runs[0]?.error).toContain("upstream down");
  });

  it("fails the record when a stage throws unexpectedly", async () => {
    const stored = buildStored();
    const repository = buildFakeRepository(stored);
    const service = new SimulationService(
      buildTestConfig(),
      repository,
      buildFakeLlmService({
        analyze: vi.fn(async () => {
          throw new Error("boom");
        }),
      }),
    );

    await service.start(BODY);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(repository.fail).toHaveBeenCalledWith("sim-1", "boom");
  });

  it("getStatus throws NotFoundError for an unknown id", async () => {
    const repository = buildFakeRepository(buildStored());
    const service = new SimulationService(buildTestConfig(), repository, buildFakeLlmService());
    await expect(service.getStatus("missing")).rejects.toThrow(NotFoundError);
  });

  it("approve/reject record the decision only — never anything else", async () => {
    const stored = buildStored({ status: "DONE" });
    const repository = buildFakeRepository(stored);
    const service = new SimulationService(buildTestConfig(), repository, buildFakeLlmService());

    await service.approve("sim-1", { decidedBy: "manager-1", notes: "looks good" });
    expect(repository.recordDecision).toHaveBeenCalledWith(
      "sim-1",
      "APPROVED",
      "manager-1",
      "looks good",
      expect.any(String),
    );

    await service.reject("sim-1", {});
    expect(repository.recordDecision).toHaveBeenCalledWith(
      "sim-1",
      "REJECTED",
      undefined,
      undefined,
      expect.any(String),
    );
  });

  it("history maps stored simulations to history entries", async () => {
    const repository = buildFakeRepository(buildStored());
    const service = new SimulationService(buildTestConfig(), repository, buildFakeLlmService());
    const history = await service.history();
    expect(history).toHaveLength(1);
    expect(history[0]?.id).toBe("sim-1");
  });
});
