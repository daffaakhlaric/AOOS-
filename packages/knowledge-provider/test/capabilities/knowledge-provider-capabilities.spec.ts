import { describe, expect, it } from "vitest";

import { KnowledgeProviderCapabilities } from "../../src/capabilities/knowledge-provider-capabilities.js";
import { KnowledgeProviderCapabilityFlag } from "../../src/domain/knowledge-provider-capability-flag.js";

describe("KnowledgeProviderCapabilities", () => {
  it("has() reports whether a flag is declared", () => {
    const capabilities = new KnowledgeProviderCapabilities([
      KnowledgeProviderCapabilityFlag.SUPPORTS_READ,
    ]);
    expect(capabilities.has(KnowledgeProviderCapabilityFlag.SUPPORTS_READ)).toBe(true);
    expect(capabilities.has(KnowledgeProviderCapabilityFlag.SUPPORTS_WRITE)).toBe(false);
  });

  it("hasAll() requires every flag to be declared", () => {
    const capabilities = new KnowledgeProviderCapabilities([
      KnowledgeProviderCapabilityFlag.SUPPORTS_READ,
      KnowledgeProviderCapabilityFlag.SUPPORTS_WRITE,
    ]);
    expect(
      capabilities.hasAll([
        KnowledgeProviderCapabilityFlag.SUPPORTS_READ,
        KnowledgeProviderCapabilityFlag.SUPPORTS_WRITE,
      ]),
    ).toBe(true);
    expect(
      capabilities.hasAll([
        KnowledgeProviderCapabilityFlag.SUPPORTS_READ,
        KnowledgeProviderCapabilityFlag.SUPPORTS_DELETE,
      ]),
    ).toBe(false);
  });

  it("hasAny() requires at least one flag to be declared", () => {
    const capabilities = new KnowledgeProviderCapabilities([
      KnowledgeProviderCapabilityFlag.SUPPORTS_READ,
    ]);
    expect(
      capabilities.hasAny([
        KnowledgeProviderCapabilityFlag.SUPPORTS_READ,
        KnowledgeProviderCapabilityFlag.SUPPORTS_DELETE,
      ]),
    ).toBe(true);
    expect(capabilities.hasAny([KnowledgeProviderCapabilityFlag.SUPPORTS_DELETE])).toBe(false);
  });

  it("list() returns every declared flag", () => {
    const capabilities = new KnowledgeProviderCapabilities([
      KnowledgeProviderCapabilityFlag.SUPPORTS_READ,
    ]);
    expect(capabilities.list()).toEqual([KnowledgeProviderCapabilityFlag.SUPPORTS_READ]);
  });

  it("size reflects the number of declared flags, deduplicated", () => {
    const capabilities = new KnowledgeProviderCapabilities([
      KnowledgeProviderCapabilityFlag.SUPPORTS_READ,
      KnowledgeProviderCapabilityFlag.SUPPORTS_READ,
    ]);
    expect(capabilities.size).toBe(1);
  });
});
