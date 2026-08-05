import { describe, expect, it } from "vitest";

import { KnowledgeIndexBuilder } from "../../src/builder/knowledge-index-builder.js";
import { KnowledgeIndexType } from "../../src/domain/knowledge-index-type.js";
import { assetFixture } from "../helpers/asset-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";

describe("Builder Test — more edge cases", () => {
  it("builds a NAMESPACE entry whose value carries the same namespace as the key", () => {
    const asset = assetFixture();
    const [entry] = new KnowledgeIndexBuilder().build(
      asset,
      KnowledgeIndexType.NAMESPACE,
      contextFixture(asset),
    );
    expect(entry?.value).toEqual({ namespace: asset.namespace });
  });

  it("builds a WORKSPACE entry defaulting to 'none' when scope has no workspaceId", () => {
    const asset = assetFixture({ scope: { tenantId: "tenant-1" } });
    const [entry] = new KnowledgeIndexBuilder().build(
      asset,
      KnowledgeIndexType.WORKSPACE,
      contextFixture(asset),
    );
    expect(entry?.key).toBe("none");
  });

  it("builds an EMBEDDING_REFERENCE entry whose embeddingRef.status is carried through", () => {
    const asset = assetFixture();
    const context = contextFixture(asset, {
      metadata: {
        embeddingRef: {
          embeddingId: "e-1",
          provider: "cohere",
          version: "2",
          model: "m2",
          status: "stale",
        },
      },
    });
    const [entry] = new KnowledgeIndexBuilder().build(
      asset,
      KnowledgeIndexType.EMBEDDING_REFERENCE,
      context,
    );
    expect(entry?.embeddingRef?.status).toBe("stale");
  });
});
