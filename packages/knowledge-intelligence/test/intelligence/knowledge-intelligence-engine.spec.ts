import { beforeEach, describe, expect, it } from "vitest";

import { InMemoryEventPublisher } from "../../src/events/in-memory-event-publisher.js";
import { KnowledgeIntelligenceEventType } from "../../src/events/knowledge-intelligence-event-type.js";
import { KnowledgeIntelligenceEngine } from "../../src/intelligence/knowledge-intelligence-engine.js";
import { KnowledgeCategory } from "../../src/types/knowledge-category.js";
import { resetFixtureState, makeClock, makeItem } from "../helpers/fixtures.js";

describe("KnowledgeIntelligenceEngine", () => {
  beforeEach(() => resetFixtureState());

  it("has a unique id and start/stop no-ops", () => {
    const engine = new KnowledgeIntelligenceEngine();
    expect(engine.id).toMatch(/^knowledge-intelligence-engine-/);
    expect(() => engine.start()).not.toThrow();
    expect(() => engine.stop()).not.toThrow();
  });

  it("runs the full intelligence pipeline end-to-end and stores a report in the registry", () => {
    const clock = makeClock(1000);
    const publisher = new InMemoryEventPublisher(clock);
    const engine = new KnowledgeIntelligenceEngine({ clock, eventPublisher: publisher });

    const items = [
      makeItem({ id: "a", tags: ["x", "y"], lastUpdatedAt: 1000, contentLength: 500 }),
      makeItem({ id: "b", tags: ["x", "y"], lastUpdatedAt: 1000, contentLength: 500 }),
      makeItem({ id: "c", tags: ["z"], lastUpdatedAt: 1000, contentLength: 500 }),
    ];

    const context = engine.runIntelligence({
      items,
      taxonomy: [
        { topic: "covered", covered: true, itemCount: 1 },
        { topic: "gap", covered: false, itemCount: 0 },
      ],
      adjacency: { a: ["b"] },
    });

    expect(context.report).toBeDefined();
    expect(engine.getReport(context.report!.id)).toBe(context.report);
    expect(context.duplicates).toHaveLength(1); // a/b identical tags
    expect(context.gapReport?.gaps).toHaveLength(1);
    expect(context.gapReport?.orphans.map((o) => o.itemId)).toContain("c");
  });

  it("publishes IntelligenceStarted and IntelligenceCompleted events around a run", () => {
    const clock = makeClock(0);
    const publisher = new InMemoryEventPublisher(clock);
    const engine = new KnowledgeIntelligenceEngine({ clock, eventPublisher: publisher });
    engine.runIntelligence({ items: [makeItem({ id: "a" })] });
    const types = publisher.getHistory().map((e) => e.eventType);
    expect(types).toContain(KnowledgeIntelligenceEventType.IntelligenceStarted);
    expect(types).toContain(KnowledgeIntelligenceEventType.IntelligenceCompleted);
    expect(types).toContain(KnowledgeIntelligenceEventType.ReportGenerated);
  });

  it("publishes IntelligenceFailed and rethrows when the pipeline fails", () => {
    const clock = makeClock(0);
    const publisher = new InMemoryEventPublisher(clock);
    const engine = new KnowledgeIntelligenceEngine({ clock, eventPublisher: publisher });
    const duplicateIdItems = [makeItem({ id: "dup" }), makeItem({ id: "dup" })];
    expect(() => engine.runIntelligence({ items: duplicateIdItems })).toThrow();
    const types = publisher.getHistory().map((e) => e.eventType);
    expect(types).toContain(KnowledgeIntelligenceEventType.IntelligenceFailed);
  });

  it("classifies a single item and publishes ClassificationCompleted", () => {
    const clock = makeClock(0);
    const publisher = new InMemoryEventPublisher(clock);
    const engine = new KnowledgeIntelligenceEngine({ clock, eventPublisher: publisher });
    const classification = engine.classify(makeItem({ category: "reference" }));
    expect(classification.category).toBe(KnowledgeCategory.Reference);
    expect(publisher.getHistory().map((e) => e.eventType)).toContain(
      KnowledgeIntelligenceEventType.ClassificationCompleted,
    );
  });

  it("classifies an entire corpus", () => {
    const engine = new KnowledgeIntelligenceEngine();
    const results = engine.classifyAll([makeItem({ id: "a" }), makeItem({ id: "b" })]);
    expect(results).toHaveLength(2);
  });

  it("suggests tags from a co-occurrence table", () => {
    const engine = new KnowledgeIntelligenceEngine();
    const item = makeItem({ tags: [], keywords: ["billing"] });
    expect(engine.suggestTags(item, { billing: ["finance"] })).toEqual(["finance"]);
  });

  it("suggests tags from similar corpus items", () => {
    const engine = new KnowledgeIntelligenceEngine();
    const item = makeItem({ id: "a", tags: ["x", "y"] });
    const similar = makeItem({ id: "b", tags: ["x", "y", "z"] });
    expect(engine.suggestTagsFromSimilarItems(item, [item, similar])).toContain("z");
  });

  it("exposes its configuration and registry", () => {
    const engine = new KnowledgeIntelligenceEngine();
    expect(engine.configuration.readinessMinScore).toBeGreaterThan(0);
    expect(engine.registrySnapshot.listReports()).toHaveLength(0);
  });

  it("takes a snapshot and stores it in the registry", () => {
    const engine = new KnowledgeIntelligenceEngine();
    const snapshot = engine.takeSnapshot({ items: [makeItem({ id: "a" })] });
    expect(engine.registrySnapshot.listSnapshots()).toContain(snapshot);
    expect(snapshot.itemCount).toBe(1);
  });

  it("defaults to a SystemClock and InMemoryEventPublisher when none are supplied", () => {
    const engine = new KnowledgeIntelligenceEngine();
    const context = engine.runIntelligence({ items: [makeItem({ id: "a" })] });
    expect(context.report).toBeDefined();
  });
});
