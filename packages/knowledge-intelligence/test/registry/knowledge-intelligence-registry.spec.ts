import { describe, expect, it } from "vitest";

import { KnowledgeIntelligenceReport } from "../../src/entities/knowledge-intelligence-report.js";
import { KnowledgeIntelligenceSnapshot } from "../../src/entities/knowledge-intelligence-snapshot.js";
import { InsightNotFoundException } from "../../src/errors/insight-not-found-exception.js";
import { RecommendationNotFoundException } from "../../src/errors/recommendation-not-found-exception.js";
import { ReportNotFoundException } from "../../src/errors/report-not-found-exception.js";
import { SnapshotNotFoundException } from "../../src/errors/snapshot-not-found-exception.js";
import { KnowledgeIntelligenceRegistry } from "../../src/registry/knowledge-intelligence-registry.js";
import { RecommendationType } from "../../src/types/recommendation-type.js";
import { ReportType } from "../../src/types/report-type.js";
import { KnowledgeInsight } from "../../src/value-objects/knowledge-insight.js";
import { KnowledgeRecommendation } from "../../src/value-objects/knowledge-recommendation.js";

function makeReport(id: string): KnowledgeIntelligenceReport {
  return new KnowledgeIntelligenceReport({
    id,
    type: ReportType.Health,
    title: "t",
    generatedAt: 0,
    sections: {},
  });
}

function makeSnapshot(id: string): KnowledgeIntelligenceSnapshot {
  return new KnowledgeIntelligenceSnapshot({
    id,
    takenAt: 0,
    itemCount: 0,
    averageHealthScore: 0,
    duplicateCount: 0,
    gapCount: 0,
    recommendationCount: 0,
  });
}

function makeRecommendation(id: string): KnowledgeRecommendation {
  return new KnowledgeRecommendation({
    id,
    type: RecommendationType.Improvement,
    itemIds: ["a"],
    reason: "x",
    priority: 50,
    createdAt: 0,
  });
}

function makeInsight(id: string): KnowledgeInsight {
  return new KnowledgeInsight({
    id,
    title: "t",
    description: "d",
    severity: "info",
    relatedItemIds: [],
    createdAt: 0,
  });
}

describe("KnowledgeIntelligenceRegistry", () => {
  it("stores and retrieves reports by id", () => {
    const registry = new KnowledgeIntelligenceRegistry();
    const report = makeReport("report-1");
    registry.putReport(report);
    expect(registry.getReport("report-1")).toBe(report);
    expect(registry.findReport("report-1")).toBe(report);
    expect(registry.findReport("missing")).toBeUndefined();
    expect(registry.listReports()).toEqual([report]);
  });

  it("throws ReportNotFoundException for a missing report", () => {
    const registry = new KnowledgeIntelligenceRegistry();
    expect(() => registry.getReport("missing")).toThrow(ReportNotFoundException);
  });

  it("stores and retrieves snapshots by id", () => {
    const registry = new KnowledgeIntelligenceRegistry();
    const snapshot = makeSnapshot("snap-1");
    registry.putSnapshot(snapshot);
    expect(registry.getSnapshot("snap-1")).toBe(snapshot);
    expect(registry.listSnapshots()).toEqual([snapshot]);
  });

  it("throws SnapshotNotFoundException for a missing snapshot", () => {
    const registry = new KnowledgeIntelligenceRegistry();
    expect(() => registry.getSnapshot("missing")).toThrow(SnapshotNotFoundException);
  });

  it("stores and retrieves recommendations by id", () => {
    const registry = new KnowledgeIntelligenceRegistry();
    const rec = makeRecommendation("rec-1");
    registry.putRecommendation(rec);
    expect(registry.getRecommendation("rec-1")).toBe(rec);
    expect(registry.listRecommendations()).toEqual([rec]);
  });

  it("throws RecommendationNotFoundException for a missing recommendation", () => {
    const registry = new KnowledgeIntelligenceRegistry();
    expect(() => registry.getRecommendation("missing")).toThrow(RecommendationNotFoundException);
  });

  it("stores and retrieves insights by id", () => {
    const registry = new KnowledgeIntelligenceRegistry();
    const insight = makeInsight("insight-1");
    registry.putInsight(insight);
    expect(registry.getInsight("insight-1")).toBe(insight);
    expect(registry.listInsights()).toEqual([insight]);
  });

  it("throws InsightNotFoundException for a missing insight", () => {
    const registry = new KnowledgeIntelligenceRegistry();
    expect(() => registry.getInsight("missing")).toThrow(InsightNotFoundException);
  });

  it("clears all buckets", () => {
    const registry = new KnowledgeIntelligenceRegistry();
    registry.putReport(makeReport("r"));
    registry.putSnapshot(makeSnapshot("s"));
    registry.putRecommendation(makeRecommendation("rec"));
    registry.putInsight(makeInsight("i"));
    registry.clear();
    expect(registry.listReports()).toHaveLength(0);
    expect(registry.listSnapshots()).toHaveLength(0);
    expect(registry.listRecommendations()).toHaveLength(0);
    expect(registry.listInsights()).toHaveLength(0);
  });
});
