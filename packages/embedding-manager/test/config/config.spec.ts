import { describe, expect, it } from "vitest";

import type { EmbeddingManagerConfig } from "../../src/config/embedding-manager-config.js";
import { EmbeddingManager } from "../../src/embedding/embedding-manager.js";
import { fakePublisher } from "../helpers/event-publisher-fixture.js";

function build(config: EmbeddingManagerConfig): EmbeddingManager {
  const { publisher } = fakePublisher();
  return new EmbeddingManager(publisher, config);
}

describe("EmbeddingManagerConfig — extension points are all optional", () => {
  it("accepts an empty config", () => {
    expect(() => build({})).not.toThrow();
  });

  it("accepts a provider", () => {
    expect(() => build({ provider: { embed: async () => ({ dimensionCount: 1 }) } })).not.toThrow();
  });

  it("accepts a modelProvider", () => {
    expect(() => build({ modelProvider: { describeModel: async () => undefined } })).not.toThrow();
  });

  it("accepts a storage provider", () => {
    expect(() => build({ storage: { store: async () => undefined } })).not.toThrow();
  });

  it("accepts a cacheProvider", () => {
    expect(() =>
      build({ cacheProvider: { lookup: async () => undefined, record: async () => undefined } }),
    ).not.toThrow();
  });

  it("accepts a scheduler", () => {
    expect(() => build({ scheduler: { schedule: async () => undefined } })).not.toThrow();
  });

  it("accepts an auditProvider", () => {
    expect(() => build({ auditProvider: { record: async () => undefined } })).not.toThrow();
  });

  it("accepts a publisher extension point (distinct from IPublisher)", () => {
    expect(() => build({ publisher: { publish: async () => undefined } })).not.toThrow();
  });

  it("accepts a compressionProvider", () => {
    expect(() =>
      build({ compressionProvider: { describe: async () => ({ algorithm: "pq" }) } }),
    ).not.toThrow();
  });

  it("accepts an encryptionProvider", () => {
    expect(() =>
      build({ encryptionProvider: { describe: async () => ({ algorithm: "aes-256" }) } }),
    ).not.toThrow();
  });

  it("accepts a costProvider", () => {
    expect(() =>
      build({ costProvider: { estimateCost: async () => ({ amount: 0, currency: "USD" }) } }),
    ).not.toThrow();
  });

  it("accepts a metricsProvider", () => {
    expect(() => build({ metricsProvider: { publish: async () => undefined } })).not.toThrow();
  });

  it("accepts a streamingProvider", () => {
    expect(() =>
      build({
        streamingProvider: {
          stream: async function* () {
            /* empty */
          },
        },
      }),
    ).not.toThrow();
  });

  it("accepts a knowledgeGraphProvider (Future Readiness)", () => {
    expect(() =>
      build({ knowledgeGraphProvider: { linkEmbeddingToNode: async () => undefined } }),
    ).not.toThrow();
  });

  it("accepts a knowledgeRecommendationProvider (Future Readiness)", () => {
    expect(() =>
      build({ knowledgeRecommendationProvider: { rankCandidates: async () => [] } }),
    ).not.toThrow();
  });
});
