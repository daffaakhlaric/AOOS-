import type { BranchManager } from "@aos/branch-manager";
import { AssignmentMode, BranchManagerFactory } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { toBranchManagerConfig } from "../../config/to-branch-manager-config.js";
import { createFakePublisher } from "../../test-support/fake-publisher.js";
import { buildTestConfig } from "../../test-support/fixtures.js";

import { BranchesService } from "./branches.service.js";

function buildManager(): BranchManager {
  const configResult = toBranchManagerConfig(buildTestConfig());
  if (!configResult.ok) {
    throw new Error("test setup failed");
  }
  return BranchManagerFactory.create({
    config: configResult.value,
    publisher: createFakePublisher(),
  });
}

describe("BranchesService", () => {
  describe("listBranches", () => {
    it("returns the 4 DSS Motor branches with an empty team by default", () => {
      const service = new BranchesService(buildManager());
      const branches = service.listBranches();
      expect(branches).toHaveLength(4);
      expect(branches.map((b) => b.id).sort()).toEqual(["BANDUNG", "BINTARO", "CINERE", "UMUM"]);
      expect(branches[0]?.team).toEqual([]);
    });
  });

  describe("updateBranch", () => {
    it("throws ValidationError for an unknown branch id", async () => {
      const service = new BranchesService(buildManager());
      await expect(service.updateBranch("NOT_A_BRANCH", {}, "dss-motor", "corr-1")).rejects.toThrow(
        /Unknown branchId/,
      );
    });

    it("changes assignmentMode and maxLeadsPerSalesPerDay via BranchRegistry.update", async () => {
      const service = new BranchesService(buildManager());
      const dto = await service.updateBranch(
        "bintaro",
        { assignmentMode: "ROUND_ROBIN", maxLeadsPerSalesPerDay: 20 },
        "dss-motor",
        "corr-1",
      );
      expect(dto.assignmentMode).toBe(AssignmentMode.ROUND_ROBIN);
      expect(dto.maxLeadsPerSalesPerDay).toBe(20);
    });

    it("adds a sales human via AddSalesHuman", async () => {
      const service = new BranchesService(buildManager());
      const dto = await service.updateBranch(
        "BINTARO",
        { addSales: [{ name: "Budi Santoso", waNumber: "+628120000001" }] },
        "dss-motor",
        "corr-1",
      );
      expect(dto.team).toHaveLength(1);
      expect(dto.team[0]?.name).toBe("Budi Santoso");
    });

    it("removes a sales human via RemoveSalesHuman", async () => {
      const manager = buildManager();
      const service = new BranchesService(manager);
      const withSales = await service.updateBranch(
        "BINTARO",
        { addSales: [{ name: "Rina Dewi", waNumber: "+628120000002" }] },
        "dss-motor",
        "corr-1",
      );
      const salesId = withSales.team[0]?.id;
      expect(salesId).toBeDefined();
      const dto = await service.updateBranch(
        "BINTARO",
        { removeSalesHumanIds: [salesId as string] },
        "dss-motor",
        "corr-2",
      );
      expect(dto.team).toEqual([]);
    });

    it("throws when removing an unknown sales human id", async () => {
      const service = new BranchesService(buildManager());
      await expect(
        service.updateBranch(
          "BINTARO",
          { removeSalesHumanIds: ["missing"] },
          "dss-motor",
          "corr-1",
        ),
      ).rejects.toThrow();
    });

    it("updates a sales human's status via UpdateSalesStatus", async () => {
      const manager = buildManager();
      const service = new BranchesService(manager);
      const withSales = await service.updateBranch(
        "BINTARO",
        { addSales: [{ name: "Budi Santoso", waNumber: "+628120000001", status: "OFF" }] },
        "dss-motor",
        "corr-1",
      );
      const salesId = withSales.team[0]?.id as string;
      const dto = await service.updateBranch(
        "BINTARO",
        { updateSalesStatus: [{ salesHumanId: salesId, status: "ON" }] },
        "dss-motor",
        "corr-2",
      );
      expect(dto.team[0]?.status).toBe("ON");
    });
  });
});
