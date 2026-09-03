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
): AgentConfigService {
  return { get: vi.fn(), set } as unknown as AgentConfigService;
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
});
