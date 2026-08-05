import { describe, expect, it } from "vitest";

import { KnowledgeLifecycleState } from "../../src/domain/knowledge-lifecycle-state.js";
import { IllegalLifecycleTransitionException } from "../../src/errors/illegal-lifecycle-transition-exception.js";
import { KnowledgeLifecycle } from "../../src/lifecycle/knowledge-lifecycle.js";
import { assetFixture } from "../helpers/asset-fixture.js";

describe("Lifecycle Test — KnowledgeLifecycle", () => {
  it("canTransition() reflects KNOWLEDGE_LIFECYCLE_TRANSITIONS", () => {
    const lifecycle = new KnowledgeLifecycle();
    expect(
      lifecycle.canTransition(
        KnowledgeLifecycleState.DRAFT,
        KnowledgeLifecycleState.PENDING_REVIEW,
      ),
    ).toBe(true);
    expect(
      lifecycle.canTransition(KnowledgeLifecycleState.DRAFT, KnowledgeLifecycleState.PUBLISHED),
    ).toBe(false);
  });

  it("transition() applies a legal transition and stamps updatedAt", () => {
    const lifecycle = new KnowledgeLifecycle();
    const asset = assetFixture();
    const updated = lifecycle.transition({ asset, to: KnowledgeLifecycleState.PENDING_REVIEW });
    expect(updated.lifecycleState).toBe(KnowledgeLifecycleState.PENDING_REVIEW);
    expect(Date.parse(updated.updatedAt)).toBeGreaterThanOrEqual(Date.parse(asset.updatedAt));
  });

  it("transition() throws IllegalLifecycleTransitionException for an illegal transition", () => {
    const lifecycle = new KnowledgeLifecycle();
    const asset = assetFixture();
    expect(() => lifecycle.transition({ asset, to: KnowledgeLifecycleState.PUBLISHED })).toThrow(
      IllegalLifecycleTransitionException,
    );
  });

  it("walks the full happy path Draft -> PendingReview -> Approved -> Published -> Indexed -> Archived", () => {
    const lifecycle = new KnowledgeLifecycle();
    let asset = assetFixture();
    asset = lifecycle.transition({ asset, to: KnowledgeLifecycleState.PENDING_REVIEW });
    asset = lifecycle.transition({ asset, to: KnowledgeLifecycleState.APPROVED });
    asset = lifecycle.transition({ asset, to: KnowledgeLifecycleState.PUBLISHED });
    asset = lifecycle.transition({ asset, to: KnowledgeLifecycleState.INDEXED });
    asset = lifecycle.transition({ asset, to: KnowledgeLifecycleState.ARCHIVED });
    expect(asset.lifecycleState).toBe(KnowledgeLifecycleState.ARCHIVED);
  });

  it("DELETED has no legal outgoing transitions", () => {
    const lifecycle = new KnowledgeLifecycle();
    const asset = { ...assetFixture(), lifecycleState: KnowledgeLifecycleState.DELETED };
    expect(() => lifecycle.transition({ asset, to: KnowledgeLifecycleState.ARCHIVED })).toThrow(
      IllegalLifecycleTransitionException,
    );
  });
});
