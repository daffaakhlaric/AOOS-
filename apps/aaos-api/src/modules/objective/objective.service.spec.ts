import type { ObjectiveEngine } from "@aos/objective-engine";
import { ObjectiveEngineFactory } from "@aos/objective-engine";
import { describe, expect, it } from "vitest";

import { toObjectiveEngineConfig } from "../../config/to-objective-engine-config.js";
import { createFakePublisher } from "../../test-support/fake-publisher.js";
import { buildTestConfig } from "../../test-support/fixtures.js";

import { ObjectiveService } from "./objective.service.js";

function buildEngine(tenantId = "dss-motor"): ObjectiveEngine {
  const configResult = toObjectiveEngineConfig(buildTestConfig({ AAOS_TENANT_ID: tenantId }));
  if (!configResult.ok) {
    throw new Error("test setup failed");
  }
  return ObjectiveEngineFactory.create({
    config: configResult.value,
    publisher: createFakePublisher(),
  });
}

function buildService(engine: ObjectiveEngine, tenantId = "dss-motor"): ObjectiveService {
  return new ObjectiveService(buildTestConfig({ AAOS_TENANT_ID: tenantId }), engine);
}

describe("ObjectiveService", () => {
  describe("getCurrentObjective", () => {
    it("throws NotFoundError when the tenant has no Objective yet", () => {
      const engine = buildEngine();
      const service = buildService(engine);
      expect(() => service.getCurrentObjective()).toThrow(/No Objective found/);
    });

    it("returns the most recently created Objective for the tenant", async () => {
      const engine = buildEngine();
      const service = buildService(engine);
      await service.createObjective(
        {
          targetHotLeads: 50,
          budgetAllocation: 30_000_000,
          focusUnits: ["Xpander"],
          areaPriorities: ["BINTARO"],
        },
        "corr-1",
      );
      const dto = service.getCurrentObjective();
      expect(dto.targetHotLeads).toBe(50);
      expect(dto.budgetAllocation).toBe(30_000_000);
      expect(dto.focusUnits).toEqual(["Xpander"]);
      expect(dto.status).toBe("DRAFT");
    });
  });

  describe("createObjective", () => {
    it("creates an Objective via @aos/objective-engine and maps it to an ObjectiveResponseDto", async () => {
      const engine = buildEngine();
      const service = buildService(engine);
      const dto = await service.createObjective(
        {
          targetHotLeads: 25,
          budgetAllocation: 10_000_000,
          focusUnits: ["Brio"],
          areaPriorities: ["CINERE"],
        },
        "corr-2",
      );
      expect(dto.id).toEqual(expect.any(String));
      expect(dto.tenantId).toBe("dss-motor");
      expect(dto.targetHotLeads).toBe(25);
      expect(dto.areaPriorities).toEqual(["CINERE"]);
    });

    it("throws the raw @aos/objective-engine error on invalid input (e.g. budgetAllocation <= 0)", async () => {
      const engine = buildEngine();
      const service = buildService(engine);
      await expect(
        service.createObjective(
          {
            targetHotLeads: 25,
            budgetAllocation: -1,
            focusUnits: ["Brio"],
            areaPriorities: ["CINERE"],
          },
          "corr-3",
        ),
      ).rejects.toThrow();
    });

    it("throws when a second Objective is created for the same tenant/month (maxObjectivesPerMonth default 1)", async () => {
      const engine = buildEngine();
      const service = buildService(engine);
      await service.createObjective(
        {
          targetHotLeads: 25,
          budgetAllocation: 10_000_000,
          focusUnits: ["Brio"],
          areaPriorities: ["CINERE"],
        },
        "corr-4",
      );
      await expect(
        service.createObjective(
          {
            targetHotLeads: 30,
            budgetAllocation: 12_000_000,
            focusUnits: ["Xpander"],
            areaPriorities: ["BANDUNG"],
          },
          "corr-5",
        ),
      ).rejects.toThrow(/already has/);
    });
  });
});
