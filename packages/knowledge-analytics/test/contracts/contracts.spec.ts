import { describe, expect, it } from "vitest";

import type { IExternalMetricsSink } from "../../src/contracts/i-external-metrics-sink.js";
import type { IKnowledgeAnalyticsEventPublisher } from "../../src/contracts/i-knowledge-analytics-event-publisher.js";
import type { IKnowledgeAnalyticsModule } from "../../src/contracts/i-knowledge-analytics-module.js";
import { KnowledgeMetricSample } from "../../src/value-objects/knowledge-metric-sample.js";

describe("IKnowledgeAnalyticsEventPublisher", () => {
  it("can be duck-typed by a plain object implementation", () => {
    const calls: string[] = [];
    const publisher: IKnowledgeAnalyticsEventPublisher = {
      publish(eventType) {
        calls.push(eventType);
      },
    };
    publisher.publish("knowledge.analytics.started", {});
    expect(calls).toEqual(["knowledge.analytics.started"]);
  });

  it("supports an async publish implementation", async () => {
    const publisher: IKnowledgeAnalyticsEventPublisher = {
      async publish() {
        await Promise.resolve();
      },
    };
    await expect(publisher.publish("x", {})).resolves.toBeUndefined();
  });
});

describe("IKnowledgeAnalyticsModule", () => {
  it("can be duck-typed by a plain object implementation", () => {
    const module: IKnowledgeAnalyticsModule = {
      id: "test-module",
      start() {},
      stop() {},
    };
    expect(module.id).toBe("test-module");
    expect(() => module.start()).not.toThrow();
    expect(() => module.stop()).not.toThrow();
  });
});

describe("IExternalMetricsSink", () => {
  it("can be duck-typed by a plain object implementation", () => {
    const received: KnowledgeMetricSample[] = [];
    const sink: IExternalMetricsSink = {
      receive(sample) {
        received.push(sample);
      },
    };
    const sample = new KnowledgeMetricSample({ name: "x", value: 1, timestamp: 0 });
    sink.receive(sample);
    expect(received).toEqual([sample]);
  });
});
