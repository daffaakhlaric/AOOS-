import { describe, expect, it, vi } from "vitest";

import type { ImprovementItem } from "../llm/dto/improvement-plan.dto.js";

import type { AgentConfigService } from "./agent-config.service.js";
import { ConfigApplierService } from "./config-applier.service.js";

function buildItem(overrides: Partial<ImprovementItem> = {}): ImprovementItem {
  return {
    agent: "SAMANTHA",
    type: "CONFIG_UPDATE",
    target: "pause_cpl_multiplier",
    before: "1.5",
    after: "1.8",
    reason: "CPL noise below the current threshold — a real, tighter bar reduces false triggers.",
    severity: "MEDIUM",
    ...overrides,
  };
}

function buildFakeAgentConfigService(
  set: AgentConfigService["set"] = vi.fn(async () => ({}) as never),
  // Real current live value the bounds check compares `item.after` against — defaults to
  // `pause_cpl_multiplier`'s real current default (1.5) so the "real successful write" test's
  // `1.8` stays comfortably in-range.
  get: AgentConfigService["get"] = vi.fn(async () => 1.5),
): AgentConfigService {
  return { get, set } as unknown as AgentConfigService;
}

describe("ConfigApplierService.applyConfigUpdate", () => {
  it("real successful write: applies a known CONFIG_UPDATE target and writes via AgentConfigService.set with the AI_AUTO_APPLY actor", async () => {
    const set = vi.fn(async () => ({}) as never);
    const agentConfig = buildFakeAgentConfigService(set);
    const service = new ConfigApplierService(agentConfig);

    const result = await service.applyConfigUpdate("dss-motor", buildItem());

    expect(result).toEqual({ applied: true });
    expect(set).toHaveBeenCalledWith(
      "dss-motor",
      "SAMANTHA",
      "pause_cpl_multiplier",
      1.8,
      "AI_AUTO_APPLY",
    );
  });

  it("real unknown-key no-op: never calls AgentConfigService.set for a target outside KNOWN_CONFIG_KEYS", async () => {
    const set = vi.fn(async () => ({}) as never);
    const agentConfig = buildFakeAgentConfigService(set);
    const service = new ConfigApplierService(agentConfig);

    const result = await service.applyConfigUpdate(
      "dss-motor",
      buildItem({ target: "some_unknown_config_key" }),
    );

    expect(result.applied).toBe(false);
    expect(set).not.toHaveBeenCalled();
  });

  it("real no-op for a non-CONFIG_UPDATE item (PROMPT_UPDATE) — never calls set", async () => {
    const set = vi.fn(async () => ({}) as never);
    const agentConfig = buildFakeAgentConfigService(set);
    const service = new ConfigApplierService(agentConfig);

    const result = await service.applyConfigUpdate(
      "dss-motor",
      buildItem({ type: "PROMPT_UPDATE", target: "analyze" }),
    );

    expect(result.applied).toBe(false);
    expect(set).not.toHaveBeenCalled();
  });

  it("real no-op for a non-numeric 'after' value — never calls set", async () => {
    const set = vi.fn(async () => ({}) as never);
    const agentConfig = buildFakeAgentConfigService(set);
    const service = new ConfigApplierService(agentConfig);

    const result = await service.applyConfigUpdate(
      "dss-motor",
      buildItem({ after: "not-a-number" }),
    );

    expect(result.applied).toBe(false);
    expect(set).not.toHaveBeenCalled();
  });

  it("real write-failure best-effort degrade: never throws, reports applied:false with a reason", async () => {
    const set = vi.fn(async () => {
      throw new Error("insert failed");
    });
    const agentConfig = buildFakeAgentConfigService(set);
    const service = new ConfigApplierService(agentConfig);

    const result = await service.applyConfigUpdate("dss-motor", buildItem());

    expect(result.applied).toBe(false);
    expect(result.reason).toContain("write failed");
  });

  describe("real bounds check (AAOS Self-Improving, Phase SI-5 — never a fabricated sandbox test)", () => {
    it("blocks a wildly out-of-range value (more than 5x the current real value) and never calls set", async () => {
      const set = vi.fn(async () => ({}) as never);
      const get = vi.fn(async () => 1.5);
      const agentConfig = buildFakeAgentConfigService(set, get);
      const service = new ConfigApplierService(agentConfig);

      const result = await service.applyConfigUpdate("dss-motor", buildItem({ after: "500" }));

      expect(result.applied).toBe(false);
      expect(result.reason).toContain("more than");
      expect(set).not.toHaveBeenCalled();
      expect(get).toHaveBeenCalledWith("dss-motor", "SAMANTHA", "pause_cpl_multiplier", 1.5);
    });

    it("blocks a wildly out-of-range value (less than 1/5th the current real value)", async () => {
      const set = vi.fn(async () => ({}) as never);
      const agentConfig = buildFakeAgentConfigService(
        set,
        vi.fn(async () => 60),
      );
      const service = new ConfigApplierService(agentConfig);

      const result = await service.applyConfigUpdate(
        "dss-motor",
        buildItem({ target: "live_run_gap_threshold", after: "1" }),
      );

      expect(result.applied).toBe(false);
      expect(set).not.toHaveBeenCalled();
    });

    it("allows a real, in-range change vs the current real value (not the LLM's own possibly-stale 'before' claim)", async () => {
      const set = vi.fn(async () => ({}) as never);
      // The item's own `before` claims "1.5", but the REAL current value (from AgentConfigService.get)
      // is already 3 — a real prior override — so the bounds check must compare against 3, not 1.5.
      const agentConfig = buildFakeAgentConfigService(
        set,
        vi.fn(async () => 3),
      );
      const service = new ConfigApplierService(agentConfig);

      const result = await service.applyConfigUpdate(
        "dss-motor",
        buildItem({ before: "1.5", after: "4" }),
      );

      expect(result.applied).toBe(true);
      expect(set).toHaveBeenCalledWith(
        "dss-motor",
        "SAMANTHA",
        "pause_cpl_multiplier",
        4,
        "AI_AUTO_APPLY",
      );
    });
  });
});
