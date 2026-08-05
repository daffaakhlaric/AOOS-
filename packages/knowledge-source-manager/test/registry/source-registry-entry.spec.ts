import { describe, expect, it } from "vitest";

import type { SourceRegistryEntry } from "../../src/registry/source-registry-entry.js";
import { configurationFixture } from "../helpers/configuration-fixture.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";

describe("SourceRegistryEntry", () => {
  it("is a plain data shape usable as a Registry entry (id + metadata + configuration)", () => {
    const entry: SourceRegistryEntry = {
      id: "source-1",
      metadata: metadataFixture(),
      configuration: configurationFixture(),
    };
    expect(entry.id).toBe(entry.metadata.sourceId);
  });
});
