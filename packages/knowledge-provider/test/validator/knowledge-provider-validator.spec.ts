import { describe, expect, it } from "vitest";

import { KnowledgeProviderCategory } from "../../src/domain/knowledge-provider-category.js";
import { CapabilitiesValidator } from "../../src/validator/capabilities-validator.js";
import { CategoryValidator } from "../../src/validator/category-validator.js";
import { ConfigurationValidator } from "../../src/validator/configuration-validator.js";
import { ExecutionTokenValidator } from "../../src/validator/execution-token-validator.js";
import { KnowledgeProviderValidator } from "../../src/validator/knowledge-provider-validator.js";
import { ProviderIdValidator } from "../../src/validator/provider-id-validator.js";
import { ProviderNameValidator } from "../../src/validator/provider-name-validator.js";
import { ProviderVersionValidator } from "../../src/validator/provider-version-validator.js";
import { TenantValidator } from "../../src/validator/tenant-validator.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";

describe("ProviderIdValidator", () => {
  it("passes matching providerIds", () => {
    expect(
      new ProviderIdValidator().validate({ metadata: metadataFixture(), context: contextFixture() })
        .valid,
    ).toBe(true);
  });

  it("flags a blank metadata.providerId", () => {
    const result = new ProviderIdValidator().validate({
      metadata: metadataFixture({ providerId: "" }),
      context: contextFixture({ providerId: "" }),
    });
    expect(result.valid).toBe(false);
  });

  it("flags a mismatch between metadata.providerId and context.providerId", () => {
    const result = new ProviderIdValidator().validate({
      metadata: metadataFixture({ providerId: "a" }),
      context: contextFixture({ providerId: "b" }),
    });
    expect(result.valid).toBe(false);
  });
});

describe("ProviderNameValidator", () => {
  it("passes a non-blank providerName", () => {
    expect(
      new ProviderNameValidator().validate({
        metadata: metadataFixture(),
        context: contextFixture(),
      }).valid,
    ).toBe(true);
  });

  it("flags a blank providerName", () => {
    const result = new ProviderNameValidator().validate({
      metadata: metadataFixture({ providerName: "" }),
      context: contextFixture(),
    });
    expect(result.valid).toBe(false);
  });
});

describe("ProviderVersionValidator", () => {
  it("passes a non-blank providerVersion", () => {
    expect(
      new ProviderVersionValidator().validate({
        metadata: metadataFixture(),
        context: contextFixture(),
      }).valid,
    ).toBe(true);
  });

  it("flags a blank providerVersion", () => {
    const result = new ProviderVersionValidator().validate({
      metadata: metadataFixture({ providerVersion: "" }),
      context: contextFixture(),
    });
    expect(result.valid).toBe(false);
  });

  it("flags a mismatch with context.providerVersion when both are set", () => {
    const result = new ProviderVersionValidator().validate({
      metadata: metadataFixture({ providerVersion: "1.0.0" }),
      context: contextFixture({ providerVersion: "2.0.0" }),
    });
    expect(result.valid).toBe(false);
  });

  it("passes when context.providerVersion is unset", () => {
    const result = new ProviderVersionValidator().validate({
      metadata: metadataFixture({ providerVersion: "1.0.0" }),
      context: contextFixture({ providerVersion: undefined }),
    });
    expect(result.valid).toBe(true);
  });
});

describe("CategoryValidator", () => {
  it("passes when metadata.providerCategory matches context.providerType", () => {
    expect(
      new CategoryValidator().validate({ metadata: metadataFixture(), context: contextFixture() })
        .valid,
    ).toBe(true);
  });

  it("flags a mismatch", () => {
    const result = new CategoryValidator().validate({
      metadata: metadataFixture({ providerCategory: KnowledgeProviderCategory.DATABASE }),
      context: contextFixture({ providerType: KnowledgeProviderCategory.DOCUMENT }),
    });
    expect(result.valid).toBe(false);
  });
});

describe("CapabilitiesValidator", () => {
  it("passes a Provider with at least one Capability", () => {
    expect(
      new CapabilitiesValidator().validate({
        metadata: metadataFixture(),
        context: contextFixture(),
      }).valid,
    ).toBe(true);
  });

  it("flags a Provider with no Capabilities", () => {
    const result = new CapabilitiesValidator().validate({
      metadata: metadataFixture({ providerCapabilities: [] }),
      context: contextFixture(),
    });
    expect(result.valid).toBe(false);
  });
});

describe("ConfigurationValidator", () => {
  it("passes ordinary configuration settings", () => {
    expect(
      new ConfigurationValidator().validate({
        metadata: metadataFixture(),
        context: contextFixture(),
      }).valid,
    ).toBe(true);
  });

  it("flags secret-looking configuration keys", () => {
    const result = new ConfigurationValidator().validate({
      metadata: metadataFixture({ providerConfiguration: { apiKey: "xyz" } }),
      context: contextFixture(),
    });
    expect(result.valid).toBe(false);
  });
});

describe("TenantValidator", () => {
  it("passes a non-blank tenantId", () => {
    expect(
      new TenantValidator().validate({ metadata: metadataFixture(), context: contextFixture() })
        .valid,
    ).toBe(true);
  });

  it("flags a blank tenantId", () => {
    const result = new TenantValidator().validate({
      metadata: metadataFixture(),
      context: contextFixture({ tenantId: " " }),
    });
    expect(result.valid).toBe(false);
  });
});

describe("ExecutionTokenValidator", () => {
  it("passes a well-formed token", () => {
    expect(
      new ExecutionTokenValidator().validate({
        metadata: metadataFixture(),
        context: contextFixture(),
      }).valid,
    ).toBe(true);
  });

  it("flags a malformed token", () => {
    const result = new ExecutionTokenValidator().validate({
      metadata: metadataFixture(),
      context: contextFixture({ token: "not-a-token" }),
    });
    expect(result.valid).toBe(false);
  });
});

describe("KnowledgeProviderValidator", () => {
  it("passes a fully valid metadata/context pair", () => {
    const validator = new KnowledgeProviderValidator();
    const result = validator.validate({ metadata: metadataFixture(), context: contextFixture() });
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("aggregates issues from multiple stages without short-circuiting", () => {
    const validator = new KnowledgeProviderValidator();
    const result = validator.validate({
      metadata: metadataFixture({ providerId: "", providerName: "" }),
      context: contextFixture({ tenantId: "" }),
    });
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThanOrEqual(3);
  });

  it("runs caller-supplied extra stages", () => {
    const extraStage = {
      name: "extra",
      validate: () => ({ valid: false, issues: [{ path: "extra", message: "always fails" }] }),
    };
    const validator = new KnowledgeProviderValidator([extraStage]);
    const result = validator.validate({ metadata: metadataFixture(), context: contextFixture() });
    expect(result.valid).toBe(false);
    expect(result.issues).toEqual([{ path: "extra", message: "always fails" }]);
  });
});
