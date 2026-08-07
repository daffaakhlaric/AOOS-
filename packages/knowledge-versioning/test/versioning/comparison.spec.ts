import { describe, expect, it } from "vitest";

import { KnowledgeVersionEvents } from "../../src/events/knowledge-version-events.js";
import { KnowledgeVersioning } from "../../src/versioning/knowledge-versioning.js";
import { configurationFixture } from "../helpers/configuration-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

function buildVersioning() {
  const { publisher, publish } = fakePublisher();
  return {
    versioning: new KnowledgeVersioning({ events: new KnowledgeVersionEvents(publisher) }),
    publish,
  };
}

async function create(versioning: KnowledgeVersioning) {
  const context = contextFixture();
  return versioning.createVersion({
    metadata: metadataFixture({ versionId: context.versionId, assetId: context.assetId }),
    configuration: configurationFixture({ versionId: context.versionId }),
    context,
  });
}

describe("Comparison", () => {
  it("records a comparison resolvable via the Resolver", async () => {
    const { versioning } = buildVersioning();
    const created = await create(versioning);
    const { comparison } = await versioning.compareVersion({
      token: created.token,
      rightVersionId: "other-v",
      result: { added: 1, removed: 2 },
    });
    expect(versioning.resolver.resolveComparison(comparison.id)).toEqual(comparison);
    expect(comparison.result).toEqual({ added: 1, removed: 2 });
  });

  it("publishes ComparisonCompleted", async () => {
    const { versioning, publish } = buildVersioning();
    const created = await create(versioning);
    await versioning.compareVersion({ token: created.token, rightVersionId: "other-v" });
    expect(publish.mock.calls.map((call) => call[0].type)).toContain(
      "knowledge.version.comparison.completed",
    );
  });

  it("does not require a result payload", async () => {
    const { versioning } = buildVersioning();
    const created = await create(versioning);
    const { comparison } = await versioning.compareVersion({
      token: created.token,
      rightVersionId: "other-v",
    });
    expect(comparison.result).toBeUndefined();
  });

  it("increments the comparison metric", async () => {
    const { versioning } = buildVersioning();
    const created = await create(versioning);
    await versioning.compareVersion({ token: created.token, rightVersionId: "a" });
    await versioning.compareVersion({ token: created.token, rightVersionId: "b" });
    expect(versioning.metrics().comparisonCount).toBe(2);
  });

  it("does not affect the version's lifecycle state", async () => {
    const { versioning } = buildVersioning();
    const created = await create(versioning);
    await versioning.compareVersion({ token: created.token, rightVersionId: "other-v" });
    expect(versioning.require(created.token).state).toBe(created.state);
  });
});
