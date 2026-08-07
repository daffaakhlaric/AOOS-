import { describe, expect, it } from "vitest";

import { KnowledgeUpdateDecisionEngine } from "../../src/services/knowledge-update-decision-engine.js";
import { KnowledgeUpdateType } from "../../src/types/update-type.js";

describe("KnowledgeUpdateDecisionEngine", () => {
  const engine = new KnowledgeUpdateDecisionEngine();

  it("returns undefined when nothing changed", () => {
    expect(engine.decide({ changed: false, reasons: [] })).toBeUndefined();
  });

  it("decides Version for a version change", () => {
    expect(engine.decide({ changed: true, reasons: ["version_changed"] })).toBe(
      KnowledgeUpdateType.Version,
    );
  });

  it("decides Version for a version added", () => {
    expect(engine.decide({ changed: true, reasons: ["version_added"] })).toBe(
      KnowledgeUpdateType.Version,
    );
  });

  it("decides Full when both checksum and extra metadata changed", () => {
    expect(
      engine.decide({ changed: true, reasons: ["checksum_changed", "extra_metadata_changed"] }),
    ).toBe(KnowledgeUpdateType.Full);
  });

  it("decides Incremental for checksum change alone", () => {
    expect(engine.decide({ changed: true, reasons: ["checksum_changed"] })).toBe(
      KnowledgeUpdateType.Incremental,
    );
  });

  it("decides Metadata for extra metadata change alone", () => {
    expect(engine.decide({ changed: true, reasons: ["extra_metadata_changed"] })).toBe(
      KnowledgeUpdateType.Metadata,
    );
  });

  it("decides Refresh for last-modified advancing alone", () => {
    expect(engine.decide({ changed: true, reasons: ["last_modified_advanced"] })).toBe(
      KnowledgeUpdateType.Refresh,
    );
  });

  it("falls back to Manual when changed but no recognized reason", () => {
    expect(engine.decide({ changed: true, reasons: ["something_else"] })).toBe(
      KnowledgeUpdateType.Manual,
    );
  });

  it("prioritizes Version over other simultaneous reasons", () => {
    expect(
      engine.decide({
        changed: true,
        reasons: ["version_changed", "checksum_changed", "extra_metadata_changed"],
      }),
    ).toBe(KnowledgeUpdateType.Version);
  });
});
