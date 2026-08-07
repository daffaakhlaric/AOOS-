import { beforeEach, describe, expect, it } from "vitest";

import { KnowledgeAnalysisEngine } from "../../src/analysis/knowledge-analysis-engine.js";
import { resetFixtureState, makeItem } from "../helpers/fixtures.js";

describe("KnowledgeAnalysisEngine", () => {
  beforeEach(() => resetFixtureState());

  it("produces no findings for a fully well-structured item", () => {
    const engine = new KnowledgeAnalysisEngine();
    const item = makeItem({
      hasSummary: true,
      hasOwner: true,
      hasExamples: true,
      requiredFieldsPresent: 4,
      requiredFieldsTotal: 4,
      contentLength: 500,
    });
    expect(engine.analyzeStructure(item)).toHaveLength(0);
  });

  it("flags a missing summary", () => {
    const engine = new KnowledgeAnalysisEngine();
    const findings = engine.analyzeStructure(makeItem({ hasSummary: false }));
    expect(findings.some((f) => f.message.includes("summary"))).toBe(true);
  });

  it("flags a missing owner", () => {
    const engine = new KnowledgeAnalysisEngine();
    const findings = engine.analyzeStructure(makeItem({ hasOwner: false }));
    expect(findings.some((f) => f.message.includes("owner"))).toBe(true);
  });

  it("flags missing examples", () => {
    const engine = new KnowledgeAnalysisEngine();
    const findings = engine.analyzeStructure(makeItem({ hasExamples: false }));
    expect(findings.some((f) => f.message.includes("examples"))).toBe(true);
  });

  it("flags incomplete required fields as a critical finding", () => {
    const engine = new KnowledgeAnalysisEngine();
    const findings = engine.analyzeStructure(
      makeItem({ requiredFieldsPresent: 1, requiredFieldsTotal: 4 }),
    );
    const finding = findings.find((f) => f.category === "completeness");
    expect(finding?.severity).toBe("critical");
    expect(finding?.message).toContain("3");
  });

  it("flags content that is too short", () => {
    const engine = new KnowledgeAnalysisEngine();
    const findings = engine.analyzeStructure(makeItem({ contentLength: 5 }));
    expect(findings.some((f) => f.message.includes("too short"))).toBe(true);
  });

  it("analyzes an entire corpus and aggregates findings", () => {
    const engine = new KnowledgeAnalysisEngine();
    const items = [makeItem({ hasSummary: false }), makeItem({ hasOwner: false })];
    expect(engine.analyzeCorpusStructure(items).length).toBeGreaterThanOrEqual(2);
  });

  it("returns no findings for an empty corpus", () => {
    const engine = new KnowledgeAnalysisEngine();
    expect(engine.analyzeCorpusStructure([])).toHaveLength(0);
  });
});
