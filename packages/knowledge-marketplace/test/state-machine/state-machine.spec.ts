import { describe, expect, it } from "vitest";

import { MarketplacePackageStatus } from "../../src/domain/marketplace-package-status.js";
import { IllegalMarketplaceTransitionException } from "../../src/errors/illegal-marketplace-transition-exception.js";
import { KnowledgeMarketplaceStateMachine } from "../../src/state-machine/knowledge-marketplace-state-machine.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("KnowledgeMarketplaceStateMachine", () => {
  const machine = new KnowledgeMarketplaceStateMachine();

  it("canTransition is true for Draft -> Submitted", () => {
    expect(
      machine.canTransition(MarketplacePackageStatus.DRAFT, MarketplacePackageStatus.SUBMITTED),
    ).toBe(true);
  });

  it("canTransition is false for Draft -> Published", () => {
    expect(
      machine.canTransition(MarketplacePackageStatus.DRAFT, MarketplacePackageStatus.PUBLISHED),
    ).toBe(false);
  });

  it("canTransition is false out of Removed", () => {
    expect(
      machine.canTransition(MarketplacePackageStatus.REMOVED, MarketplacePackageStatus.DRAFT),
    ).toBe(false);
  });

  it("transition performs a legal transition and appends history", () => {
    const execution = executionFixture();
    const result = machine.transition({
      execution,
      to: MarketplacePackageStatus.SUBMITTED,
      operation: "submit_listing",
    });
    expect(result.instance.state).toBe(MarketplacePackageStatus.SUBMITTED);
    expect(result.history).toHaveLength(1);
    expect(result.history[0]?.toState).toBe(MarketplacePackageStatus.SUBMITTED);
  });

  it("transition throws IllegalMarketplaceTransitionException for an illegal transition", () => {
    const execution = executionFixture();
    expect(() => machine.transition({ execution, to: MarketplacePackageStatus.PUBLISHED })).toThrow(
      IllegalMarketplaceTransitionException,
    );
  });

  it("transition stamps publishedAt when entering Published", () => {
    let execution = executionFixture();
    execution = machine.transition({ execution, to: MarketplacePackageStatus.SUBMITTED });
    execution = machine.transition({ execution, to: MarketplacePackageStatus.REVIEWING });
    execution = machine.transition({ execution, to: MarketplacePackageStatus.CERTIFIED });
    execution = machine.transition({ execution, to: MarketplacePackageStatus.PUBLISHED });
    expect(execution.instance.publishedAt).toBeDefined();
  });

  it("transition stamps removedAt when entering Removed", () => {
    const execution = executionFixture();
    const result = machine.transition({ execution, to: MarketplacePackageStatus.REMOVED });
    expect(result.instance.removedAt).toBeDefined();
  });

  it("transition defaults operation to 'transition' when not supplied", () => {
    const execution = executionFixture();
    const result = machine.transition({ execution, to: MarketplacePackageStatus.SUBMITTED });
    expect(result.history[0]?.operation).toBe("transition");
  });

  it("transition sequence numbers increment across successive calls", () => {
    let execution = executionFixture();
    execution = machine.transition({ execution, to: MarketplacePackageStatus.SUBMITTED });
    execution = machine.transition({ execution, to: MarketplacePackageStatus.REVIEWING });
    expect(execution.history[1]?.sequence).toBe(1);
  });

  it("Reviewing can go back to Draft on rejection", () => {
    expect(
      machine.canTransition(MarketplacePackageStatus.REVIEWING, MarketplacePackageStatus.DRAFT),
    ).toBe(true);
  });

  it("Suspended can return to Published", () => {
    expect(
      machine.canTransition(MarketplacePackageStatus.SUSPENDED, MarketplacePackageStatus.PUBLISHED),
    ).toBe(true);
  });

  /* Independently-authored full 9x9 legality matrix — protects the FSM edges from
   * accidental drift. Directly mirrors "LIFECYCLE: Draft, Submitted, Reviewing,
   * Certified, Published, Deprecated, Suspended, Archived, Removed. Removed is terminal."
   */
  const EXPECTED_LEGAL_EDGES: ReadonlySet<string> = new Set([
    "draft->submitted",
    "draft->removed",
    "submitted->reviewing",
    "submitted->draft",
    "submitted->removed",
    "reviewing->certified",
    "reviewing->draft",
    "reviewing->removed",
    "certified->published",
    "certified->removed",
    "published->deprecated",
    "published->suspended",
    "published->archived",
    "published->removed",
    "deprecated->archived",
    "deprecated->removed",
    "suspended->published",
    "suspended->archived",
    "suspended->removed",
    "archived->removed",
  ]);

  const ALL_STATE_PAIRS = Object.values(MarketplacePackageStatus).flatMap((from) =>
    Object.values(MarketplacePackageStatus).map((to) => [from, to] as const),
  );

  it.each(ALL_STATE_PAIRS)("canTransition(%s, %s) matches the authored FSM matrix", (from, to) => {
    const expected = EXPECTED_LEGAL_EDGES.has(`${from}->${to}`);
    expect(machine.canTransition(from, to)).toBe(expected);
  });
});
