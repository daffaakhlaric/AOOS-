import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_SIMULATOR_CONFIG,
  parseSimulatorConfig,
} from "../../../src/config/SimulatorConfig.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("SimulatorConfig", () => {
  it("DEFAULT_SIMULATOR_CONFIG matches the spec's defaults", () => {
    expect(DEFAULT_SIMULATOR_CONFIG.maxTurnsPerSimulation).toBe(15);
    expect(DEFAULT_SIMULATOR_CONFIG.maxDurationMs).toBe(30_000);
    expect(DEFAULT_SIMULATOR_CONFIG.branchId).toBe(BranchId.CINERE);
    expect(DEFAULT_SIMULATOR_CONFIG.useRealInventory).toBe(false);
    expect(DEFAULT_SIMULATOR_CONFIG.delayBetweenTurnsMs).toBe(0);
    expect(DEFAULT_SIMULATOR_CONFIG.tenantId).toBe("tenant-dss-motor");
  });

  it("parseSimulatorConfig() defaults every field when given an empty object", () => {
    const config = unwrap(parseSimulatorConfig({}));
    expect(config).toEqual(DEFAULT_SIMULATOR_CONFIG);
  });

  it("parseSimulatorConfig() defaults every field when given undefined", () => {
    const config = unwrap(parseSimulatorConfig(undefined));
    expect(config).toEqual(DEFAULT_SIMULATOR_CONFIG);
  });

  it("parseSimulatorConfig() honors overrides", () => {
    const config = unwrap(
      parseSimulatorConfig({
        maxTurnsPerSimulation: 5,
        branchId: BranchId.BANDUNG,
        useRealInventory: true,
      }),
    );
    expect(config.maxTurnsPerSimulation).toBe(5);
    expect(config.branchId).toBe(BranchId.BANDUNG);
    expect(config.useRealInventory).toBe(true);
  });

  it("parseSimulatorConfig() rejects a non-positive maxTurnsPerSimulation", () => {
    const error = unwrapErr(parseSimulatorConfig({ maxTurnsPerSimulation: 0 }));
    expect(error.message.length).toBeGreaterThan(0);
  });

  it("parseSimulatorConfig() rejects an empty tenantId", () => {
    const error = unwrapErr(parseSimulatorConfig({ tenantId: "" }));
    expect(error.message).toContain("tenantId");
  });

  it("parseSimulatorConfig() rejects a negative delayBetweenTurnsMs", () => {
    const error = unwrapErr(parseSimulatorConfig({ delayBetweenTurnsMs: -1 }));
    expect(error.message.length).toBeGreaterThan(0);
  });

  it("parseSimulatorConfig() rejects a non-positive maxDurationMs", () => {
    const error = unwrapErr(parseSimulatorConfig({ maxDurationMs: 0 }));
    expect(error.message.length).toBeGreaterThan(0);
  });

  it("parseSimulatorConfig() rejects an invalid branchId", () => {
    const error = unwrapErr(parseSimulatorConfig({ branchId: "NOT_A_BRANCH" }));
    expect(error.message.length).toBeGreaterThan(0);
  });

  it("parseSimulatorConfig() accepts every valid BranchId member", () => {
    for (const branchId of [BranchId.BINTARO, BranchId.CINERE, BranchId.UMUM, BranchId.BANDUNG]) {
      const config = unwrap(parseSimulatorConfig({ branchId }));
      expect(config.branchId).toBe(branchId);
    }
  });
});
