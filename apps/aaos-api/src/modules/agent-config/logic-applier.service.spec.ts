import { describe, expect, it, vi } from "vitest";

import type { ImprovementItem } from "../llm/dto/improvement-plan.dto.js";

import type { AgentLogicService } from "./agent-logic.service.js";
import { LogicApplierService } from "./logic-applier.service.js";

const WELL_FORMED_DEFINITION = [
  { conditions: [{ field: "frequency", operator: "gte", value: 3.5 }], result: "REFRESH" },
];

function buildItem(overrides: Partial<ImprovementItem> = {}): ImprovementItem {
  return {
    agent: "SAMANTHA",
    type: "LOGIC_UPDATE",
    target: "verdict_classification",
    before: "[]",
    after: JSON.stringify(WELL_FORMED_DEFINITION),
    reason: "Real, tighter refresh threshold reduces false REFRESH triggers.",
    severity: "MEDIUM",
    ...overrides,
  };
}

function buildFakeAgentLogicService(
  set: AgentLogicService["set"] = vi.fn(async () => ({}) as never),
): AgentLogicService {
  return { get: vi.fn(), set } as unknown as AgentLogicService;
}

describe("LogicApplierService.applyLogicUpdate", () => {
  it("real successful write: applies a known LOGIC_UPDATE target and writes via AgentLogicService.set with the AI_AUTO_APPLY actor", async () => {
    const set = vi.fn(async () => ({}) as never);
    const agentLogic = buildFakeAgentLogicService(set);
    const service = new LogicApplierService(agentLogic);

    const result = await service.applyLogicUpdate("dss-motor", buildItem());

    expect(result).toEqual({ applied: true });
    expect(set).toHaveBeenCalledWith(
      "dss-motor",
      "SAMANTHA",
      "verdict_classification",
      WELL_FORMED_DEFINITION,
      "AI_AUTO_APPLY",
    );
  });

  it("real unknown-key no-op: never calls AgentLogicService.set for a target outside KNOWN_LOGIC_KEYS", async () => {
    const set = vi.fn(async () => ({}) as never);
    const agentLogic = buildFakeAgentLogicService(set);
    const service = new LogicApplierService(agentLogic);

    const result = await service.applyLogicUpdate(
      "dss-motor",
      buildItem({ target: "some_unknown_logic_key" }),
    );

    expect(result.applied).toBe(false);
    expect(set).not.toHaveBeenCalled();
  });

  it("real no-op for a non-LOGIC_UPDATE item (CONFIG_UPDATE) — never calls set", async () => {
    const set = vi.fn(async () => ({}) as never);
    const agentLogic = buildFakeAgentLogicService(set);
    const service = new LogicApplierService(agentLogic);

    const result = await service.applyLogicUpdate(
      "dss-motor",
      buildItem({ type: "CONFIG_UPDATE", target: "pause_cpl_multiplier" }),
    );

    expect(result.applied).toBe(false);
    expect(set).not.toHaveBeenCalled();
  });

  it("real no-op for non-JSON 'after' text — never calls set, never throws", async () => {
    const set = vi.fn(async () => ({}) as never);
    const agentLogic = buildFakeAgentLogicService(set);
    const service = new LogicApplierService(agentLogic);

    const result = await service.applyLogicUpdate(
      "dss-motor",
      buildItem({ after: "not real json {{{" }),
    );

    expect(result.applied).toBe(false);
    expect(result.reason).toContain("malformed");
    expect(set).not.toHaveBeenCalled();
  });

  it("real no-op for structurally malformed (but valid JSON) 'after' — never calls set", async () => {
    const set = vi.fn(async () => ({}) as never);
    const agentLogic = buildFakeAgentLogicService(set);
    const service = new LogicApplierService(agentLogic);

    const result = await service.applyLogicUpdate(
      "dss-motor",
      buildItem({ after: JSON.stringify([{ notARealRule: true }]) }),
    );

    expect(result.applied).toBe(false);
    expect(set).not.toHaveBeenCalled();
  });

  it("real write-failure best-effort degrade: never throws, reports applied:false with a reason", async () => {
    const set = vi.fn(async () => {
      throw new Error("insert failed");
    });
    const agentLogic = buildFakeAgentLogicService(set);
    const service = new LogicApplierService(agentLogic);

    const result = await service.applyLogicUpdate("dss-motor", buildItem());

    expect(result.applied).toBe(false);
    expect(result.reason).toContain("write failed");
  });
});
