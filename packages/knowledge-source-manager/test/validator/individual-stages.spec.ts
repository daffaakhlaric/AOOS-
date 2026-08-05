import { describe, expect, it } from "vitest";

import { CategoryValidator } from "../../src/validator/category-validator.js";
import { ExecutionTokenValidator } from "../../src/validator/execution-token-validator.js";
import { ProviderReferenceValidator } from "../../src/validator/provider-reference-validator.js";
import { SourceIdValidator } from "../../src/validator/source-id-validator.js";
import { SourceNameValidator } from "../../src/validator/source-name-validator.js";
import { TenantValidator } from "../../src/validator/tenant-validator.js";
import { configurationFixture } from "../helpers/configuration-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";

function input(overrides: Parameters<typeof metadataFixture>[0] = {}) {
  return {
    metadata: metadataFixture(overrides),
    context: contextFixture(),
    configuration: configurationFixture(),
  };
}

describe("SourceIdValidator", () => {
  it("passes for matching non-empty ids", () => {
    expect(new SourceIdValidator().validate(input()).valid).toBe(true);
  });

  it("flags an empty metadata sourceId", () => {
    expect(new SourceIdValidator().validate(input({ sourceId: "" })).valid).toBe(false);
  });
});

describe("SourceNameValidator", () => {
  it("flags an empty sourceName", () => {
    expect(new SourceNameValidator().validate(input({ sourceName: "" })).valid).toBe(false);
  });

  it("passes for a non-empty sourceName", () => {
    expect(new SourceNameValidator().validate(input()).valid).toBe(true);
  });
});

describe("ProviderReferenceValidator", () => {
  it("flags an empty providerId", () => {
    expect(new ProviderReferenceValidator().validate(input({ providerId: "" })).valid).toBe(false);
  });

  it("passes when providerId matches context", () => {
    expect(new ProviderReferenceValidator().validate(input()).valid).toBe(true);
  });
});

describe("CategoryValidator", () => {
  it("passes when sourceCategory is set", () => {
    expect(new CategoryValidator().validate(input()).valid).toBe(true);
  });
});

describe("TenantValidator", () => {
  it("passes for a non-empty tenantId", () => {
    expect(new TenantValidator().validate(input()).valid).toBe(true);
  });
});

describe("ExecutionTokenValidator", () => {
  it("passes for a well-formed token", () => {
    expect(new ExecutionTokenValidator().validate(input()).valid).toBe(true);
  });
});
