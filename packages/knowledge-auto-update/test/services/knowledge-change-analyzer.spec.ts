import { describe, expect, it } from "vitest";

import { KnowledgeChangeAnalyzer } from "../../src/services/knowledge-change-analyzer.js";
import { ChangeMagnitude } from "../../src/types/change-magnitude.js";

describe("KnowledgeChangeAnalyzer", () => {
  const analyzer = new KnowledgeChangeAnalyzer();

  it("classifies no change as None", () => {
    expect(analyzer.classify({ changed: false, reasons: [] })).toBe(ChangeMagnitude.None);
  });

  it("classifies a version change as Structural", () => {
    expect(analyzer.classify({ changed: true, reasons: ["version_changed"] })).toBe(
      ChangeMagnitude.Structural,
    );
  });

  it("classifies a version added as Structural", () => {
    expect(analyzer.classify({ changed: true, reasons: ["version_added"] })).toBe(
      ChangeMagnitude.Structural,
    );
  });

  it("classifies a checksum change as Content", () => {
    expect(analyzer.classify({ changed: true, reasons: ["checksum_changed"] })).toBe(
      ChangeMagnitude.Content,
    );
  });

  it("classifies other changes as MetadataOnly", () => {
    expect(analyzer.classify({ changed: true, reasons: ["extra_metadata_changed"] })).toBe(
      ChangeMagnitude.MetadataOnly,
    );
  });

  it("classifies checksum_added the same as checksum_changed (Content)", () => {
    expect(analyzer.classify({ changed: true, reasons: ["checksum_added"] })).toBe(
      ChangeMagnitude.MetadataOnly,
    );
  });

  it("prioritizes Content over MetadataOnly when both reasons present", () => {
    expect(
      analyzer.classify({ changed: true, reasons: ["checksum_changed", "extra_metadata_changed"] }),
    ).toBe(ChangeMagnitude.Content);
  });

  it("prioritizes Structural over Content when both reasons present", () => {
    expect(
      analyzer.classify({ changed: true, reasons: ["checksum_changed", "version_changed"] }),
    ).toBe(ChangeMagnitude.Structural);
  });
});
