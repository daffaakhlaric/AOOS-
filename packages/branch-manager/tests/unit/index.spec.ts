import { describe, expect, it } from "vitest";

import * as pkg from "../../src/index.js";

describe("@aos/branch-manager public API", () => {
  it("exports the factory", () => {
    expect(pkg.BranchManagerFactory).toBeDefined();
  });

  it("exports all 9 use cases", () => {
    expect(pkg.AssignLead).toBeDefined();
    expect(pkg.DetectBranch).toBeDefined();
    expect(pkg.UpdateSalesStatus).toBeDefined();
    expect(pkg.AddSalesHuman).toBeDefined();
    expect(pkg.RemoveSalesHuman).toBeDefined();
    expect(pkg.GetBranchStatus).toBeDefined();
    expect(pkg.GetAssignmentQueue).toBeDefined();
    expect(pkg.FlushQueue).toBeDefined();
    expect(pkg.GetAvailableSales).toBeDefined();
  });

  it("exports the 3 services", () => {
    expect(pkg.LeadAssignmentService).toBeDefined();
    expect(pkg.AvailabilityService).toBeDefined();
    expect(pkg.QueueService).toBeDefined();
  });

  it("exports the value objects and enums", () => {
    expect(pkg.BranchId).toBeDefined();
    expect(pkg.SalesStatus).toBeDefined();
    expect(pkg.AssignmentMode).toBeDefined();
    expect(pkg.SalesHumanId).toBeDefined();
    expect(pkg.AssignmentId).toBeDefined();
    expect(pkg.ActiveLeadCount).toBeDefined();
    expect(pkg.DailyLeadCount).toBeDefined();
    expect(pkg.MaxLeadsPerDay).toBeDefined();
  });

  it("exports all 5 errors", () => {
    expect(pkg.BranchNotFoundError).toBeDefined();
    expect(pkg.SalesHumanNotFoundError).toBeDefined();
    expect(pkg.NoAvailableSalesError).toBeDefined();
    expect(pkg.AssignmentError).toBeDefined();
    expect(pkg.BranchConfigError).toBeDefined();
  });

  it("exports the registries and strategies", () => {
    expect(pkg.BranchRegistry).toBeDefined();
    expect(pkg.SalesTeamRegistry).toBeDefined();
    expect(pkg.SmartAssignStrategy).toBeDefined();
    expect(pkg.RoundRobinStrategy).toBeDefined();
    expect(pkg.ManualAssignStrategy).toBeDefined();
  });

  it("exports the builders and config helpers", () => {
    expect(pkg.BranchConfigBuilder).toBeDefined();
    expect(pkg.SalesHumanBuilder).toBeDefined();
    expect(pkg.LeadAssignmentBuilder).toBeDefined();
    expect(pkg.parseBranchManagerConfig).toBeDefined();
    expect(pkg.BranchManagerConfigSchema).toBeDefined();
  });

  it("exports the events wrapper and the Branch entity", () => {
    expect(pkg.BranchManagerEvents).toBeDefined();
    expect(pkg.Branch).toBeDefined();
  });

  it("exports AssignmentQueue helpers", () => {
    expect(pkg.AssignmentQueue).toBeDefined();
    expect(pkg.createQueuedLead).toBeDefined();
    expect(pkg.QueuedLeadSchema).toBeDefined();
  });

  it("exports BranchId helpers", () => {
    expect(pkg.ALL_BRANCH_IDS).toBeDefined();
    expect(pkg.fromBranch).toBeDefined();
    expect(pkg.toBranch).toBeDefined();
  });
});
