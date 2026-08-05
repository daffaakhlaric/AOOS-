import { describe, expect, it } from "vitest";

import {
  aiConsensusNodeConfigSchema,
  aiCriticNodeConfigSchema,
  aiDebateNodeConfigSchema,
  aiPlannerNodeConfigSchema,
  aiReasonNodeConfigSchema,
  aiReflectionNodeConfigSchema,
  aiSimulationNodeConfigSchema,
  aiVotingNodeConfigSchema,
  capabilityNodeConfigSchema,
  humanApprovalNodeConfigSchema,
  knowledgeSearchNodeConfigSchema,
  promptNodeConfigSchema,
} from "../../src/contracts/ai-native/index.js";

describe("AI-native Node config schemas — contract only, no execution", () => {
  it("AIPlannerNode requires a goal", () => {
    expect(aiPlannerNodeConfigSchema.safeParse({ goal: "ship the feature" }).success).toBe(true);
    expect(aiPlannerNodeConfigSchema.safeParse({}).success).toBe(false);
  });

  it("AIReasonNode requires a question", () => {
    expect(aiReasonNodeConfigSchema.safeParse({ question: "why?" }).success).toBe(true);
    expect(aiReasonNodeConfigSchema.safeParse({}).success).toBe(false);
  });

  it("AIReflectionNode requires a subjectNodeId", () => {
    expect(aiReflectionNodeConfigSchema.safeParse({ subjectNodeId: "n-1" }).success).toBe(true);
    expect(aiReflectionNodeConfigSchema.safeParse({}).success).toBe(false);
  });

  it("AICriticNode requires a targetNodeId", () => {
    expect(aiCriticNodeConfigSchema.safeParse({ targetNodeId: "n-1" }).success).toBe(true);
    expect(aiCriticNodeConfigSchema.safeParse({}).success).toBe(false);
  });

  it("AIDebateNode requires a topic and at least 2 participants", () => {
    expect(
      aiDebateNodeConfigSchema.safeParse({ topic: "roadmap", participantCount: 2 }).success,
    ).toBe(true);
    expect(
      aiDebateNodeConfigSchema.safeParse({ topic: "roadmap", participantCount: 1 }).success,
    ).toBe(false);
  });

  it("AIVotingNode requires at least 2 candidate Node ids", () => {
    expect(aiVotingNodeConfigSchema.safeParse({ candidateNodeIds: ["a", "b"] }).success).toBe(true);
    expect(aiVotingNodeConfigSchema.safeParse({ candidateNodeIds: ["a"] }).success).toBe(false);
  });

  it("AIConsensusNode requires at least 2 participant Node ids and an optional 0-1 threshold", () => {
    expect(
      aiConsensusNodeConfigSchema.safeParse({ participantNodeIds: ["a", "b"], threshold: 0.6 })
        .success,
    ).toBe(true);
    expect(
      aiConsensusNodeConfigSchema.safeParse({ participantNodeIds: ["a", "b"], threshold: 1.5 })
        .success,
    ).toBe(false);
  });

  it("AISimulationNode requires a scenario", () => {
    expect(aiSimulationNodeConfigSchema.safeParse({ scenario: "peak load" }).success).toBe(true);
    expect(aiSimulationNodeConfigSchema.safeParse({}).success).toBe(false);
  });

  it("PromptNode requires a template", () => {
    expect(promptNodeConfigSchema.safeParse({ template: "Hello {{name}}" }).success).toBe(true);
    expect(promptNodeConfigSchema.safeParse({}).success).toBe(false);
  });

  it("KnowledgeSearchNode requires a query", () => {
    expect(knowledgeSearchNodeConfigSchema.safeParse({ query: "refund policy" }).success).toBe(
      true,
    );
    expect(knowledgeSearchNodeConfigSchema.safeParse({}).success).toBe(false);
  });

  it("CapabilityNode requires a capabilityId — never a Tool/Connector reference", () => {
    expect(capabilityNodeConfigSchema.safeParse({ capabilityId: "crm.create" }).success).toBe(true);
    expect(capabilityNodeConfigSchema.safeParse({}).success).toBe(false);
  });

  it("HumanApprovalNode requires an approverRole", () => {
    expect(humanApprovalNodeConfigSchema.safeParse({ approverRole: "manager" }).success).toBe(true);
    expect(humanApprovalNodeConfigSchema.safeParse({}).success).toBe(false);
  });
});
