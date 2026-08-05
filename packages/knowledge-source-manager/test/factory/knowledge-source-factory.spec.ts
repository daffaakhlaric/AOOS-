import { describe, expect, it } from "vitest";

import { KnowledgeSourceCategory } from "../../src/domain/knowledge-source-category.js";
import { KnowledgeSourceFactory } from "../../src/factory/knowledge-source-factory.js";
import { KnowledgeSourceScheduleMode } from "../../src/scheduler/knowledge-source-schedule-mode.js";

describe("KnowledgeSourceFactory", () => {
  it("composes all 5 sub-factories", () => {
    const factory = new KnowledgeSourceFactory();
    expect(factory.context).toBeDefined();
    expect(factory.session).toBeDefined();
    expect(factory.metadata).toBeDefined();
    expect(factory.configuration).toBeDefined();
    expect(factory.statistics).toBeDefined();
  });

  it("context factory builds a KnowledgeSourceContext", () => {
    const factory = new KnowledgeSourceFactory();
    const context = factory.context.create({ sourceId: "s-1", providerId: "p-1", tenantId: "t-1" });
    expect(context.sourceId).toBe("s-1");
    expect(context.token).toMatch(/^ksrc_/);
  });

  it("session factory builds an OPEN session record", () => {
    const factory = new KnowledgeSourceFactory();
    const record = factory.session.create("tok-1", "holder-1");
    expect(record.state).toBe("open");
    expect(record.token).toBe("tok-1");
  });

  it("metadata factory defaults optional list fields to empty and stamps timestamps", () => {
    const factory = new KnowledgeSourceFactory();
    const metadata = factory.metadata.create({
      sourceId: "s-1",
      sourceName: "Source One",
      sourceCategory: KnowledgeSourceCategory.DOCUMENT,
      sourceProvider: "Google Drive",
      providerId: "p-1",
      tenantId: "t-1",
    });
    expect(metadata.labels).toEqual([]);
    expect(metadata.tags).toEqual([]);
    expect(metadata.priority).toBe(0);
    expect(metadata.createdAt).toBeTruthy();
    expect(metadata.updatedAt).toBeTruthy();
  });

  it("metadata factory preserves supplied optional fields", () => {
    const factory = new KnowledgeSourceFactory();
    const metadata = factory.metadata.create({
      sourceId: "s-1",
      sourceName: "Source One",
      sourceCategory: KnowledgeSourceCategory.DOCUMENT,
      sourceProvider: "Google Drive",
      providerId: "p-1",
      tenantId: "t-1",
      labels: ["a"],
      tags: ["b"],
      priority: 5,
      owner: "alice",
    });
    expect(metadata.labels).toEqual(["a"]);
    expect(metadata.priority).toBe(5);
    expect(metadata.owner).toBe("alice");
  });

  it("configuration factory defaults to Manual/disabled", () => {
    const factory = new KnowledgeSourceFactory();
    const configuration = factory.configuration.create({ sourceId: "s-1" });
    expect(configuration.syncMode).toBe(KnowledgeSourceScheduleMode.MANUAL);
    expect(configuration.enabled).toBe(false);
    expect(configuration.autoSync).toBe(false);
    expect(configuration.incremental).toBe(false);
    expect(configuration.versioning).toBe(false);
  });

  it("configuration factory preserves supplied overrides", () => {
    const factory = new KnowledgeSourceFactory();
    const configuration = factory.configuration.create({
      sourceId: "s-1",
      enabled: true,
      priority: 3,
      retentionDays: 30,
    });
    expect(configuration.enabled).toBe(true);
    expect(configuration.priority).toBe(3);
    expect(configuration.retentionDays).toBe(30);
  });

  it("statistics factory builds an empty snapshot", () => {
    const factory = new KnowledgeSourceFactory();
    expect(factory.statistics.create()).toEqual({ registrationCount: 0, usageCount: 0 });
  });
});
