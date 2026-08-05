import { describe, expect, it } from "vitest";

import { KnowledgeSynchronizationJobType } from "../../src/domain/knowledge-synchronization-job-type.js";
import { KnowledgeSynchronizationMode } from "../../src/domain/knowledge-synchronization-mode.js";
import { ExecutionTokenValidator } from "../../src/validator/execution-token-validator.js";
import { KnowledgeSynchronizationValidator } from "../../src/validator/knowledge-synchronization-validator.js";
import { MetadataValidator } from "../../src/validator/metadata-validator.js";
import { NamespaceValidator } from "../../src/validator/namespace-validator.js";
import { PermissionValidator } from "../../src/validator/permission-validator.js";
import { PolicyValidator } from "../../src/validator/policy-validator.js";
import { ProviderValidator } from "../../src/validator/provider-validator.js";
import { RelationshipValidator } from "../../src/validator/relationship-validator.js";
import { ScheduleValidator } from "../../src/validator/schedule-validator.js";
import { SourceValidator } from "../../src/validator/source-validator.js";
import { TenantValidator } from "../../src/validator/tenant-validator.js";
import { VersionValidator } from "../../src/validator/version-validator.js";
import { WorkspaceValidator } from "../../src/validator/workspace-validator.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { jobFixture } from "../helpers/job-fixture.js";

describe("ProviderValidator", () => {
  it("passes matching providerIds", () => {
    expect(
      new ProviderValidator().validate({ job: jobFixture(), context: contextFixture() }).valid,
    ).toBe(true);
  });

  it("flags a blank job.providerId", () => {
    const result = new ProviderValidator().validate({
      job: jobFixture({ providerId: "" }),
      context: contextFixture({ providerId: "" }),
    });
    expect(result.valid).toBe(false);
  });

  it("flags a mismatch between job.providerId and context.providerId", () => {
    const result = new ProviderValidator().validate({
      job: jobFixture({ providerId: "a" }),
      context: contextFixture({ providerId: "b" }),
    });
    expect(result.valid).toBe(false);
  });
});

describe("SourceValidator", () => {
  it("passes matching sourceIds", () => {
    expect(
      new SourceValidator().validate({ job: jobFixture(), context: contextFixture() }).valid,
    ).toBe(true);
  });

  it("flags a blank job.sourceId", () => {
    const result = new SourceValidator().validate({
      job: jobFixture({ sourceId: "" }),
      context: contextFixture({ sourceId: "" }),
    });
    expect(result.valid).toBe(false);
  });

  it("flags a mismatch between job.sourceId and context.sourceId", () => {
    const result = new SourceValidator().validate({
      job: jobFixture({ sourceId: "a" }),
      context: contextFixture({ sourceId: "b" }),
    });
    expect(result.valid).toBe(false);
  });
});

describe("NamespaceValidator", () => {
  it("passes when neither namespace is set", () => {
    expect(
      new NamespaceValidator().validate({ job: jobFixture(), context: contextFixture() }).valid,
    ).toBe(true);
  });

  it("flags a blank job.namespace", () => {
    const result = new NamespaceValidator().validate({
      job: jobFixture({ namespace: "  " }),
      context: contextFixture(),
    });
    expect(result.valid).toBe(false);
  });

  it("flags a blank context.namespace", () => {
    const result = new NamespaceValidator().validate({
      job: jobFixture(),
      context: contextFixture({ namespace: " " }),
    });
    expect(result.valid).toBe(false);
  });

  it("flags a mismatch when both are set", () => {
    const result = new NamespaceValidator().validate({
      job: jobFixture({ namespace: "a" }),
      context: contextFixture({ namespace: "b" }),
    });
    expect(result.valid).toBe(false);
  });

  it("passes when both match", () => {
    const result = new NamespaceValidator().validate({
      job: jobFixture({ namespace: "a" }),
      context: contextFixture({ namespace: "a" }),
    });
    expect(result.valid).toBe(true);
  });
});

describe("PolicyValidator", () => {
  it("passes when policy is unset", () => {
    expect(
      new PolicyValidator().validate({ job: jobFixture(), context: contextFixture() }).valid,
    ).toBe(true);
  });

  it("flags a blank context.policy", () => {
    const result = new PolicyValidator().validate({
      job: jobFixture(),
      context: contextFixture({ policy: " " }),
    });
    expect(result.valid).toBe(false);
  });
});

describe("PermissionValidator", () => {
  it("passes when permission is unset", () => {
    expect(
      new PermissionValidator().validate({ job: jobFixture(), context: contextFixture() }).valid,
    ).toBe(true);
  });

  it("flags a blank context.permission", () => {
    const result = new PermissionValidator().validate({
      job: jobFixture(),
      context: contextFixture({ permission: " " }),
    });
    expect(result.valid).toBe(false);
  });
});

describe("ScheduleValidator", () => {
  it("passes a SCHEDULED mode Job with SCHEDULED_SYNC type", () => {
    const result = new ScheduleValidator().validate({
      job: jobFixture({
        mode: KnowledgeSynchronizationMode.SCHEDULED,
        type: KnowledgeSynchronizationJobType.SCHEDULED_SYNC,
      }),
      context: contextFixture(),
    });
    expect(result.valid).toBe(true);
  });

  it("flags a SCHEDULED mode Job with a non-SCHEDULED_SYNC type", () => {
    const result = new ScheduleValidator().validate({
      job: jobFixture({
        mode: KnowledgeSynchronizationMode.SCHEDULED,
        type: KnowledgeSynchronizationJobType.MANUAL_SYNC,
      }),
      context: contextFixture(),
    });
    expect(result.valid).toBe(false);
  });

  it("passes a MANUAL mode Job regardless of type", () => {
    const result = new ScheduleValidator().validate({
      job: jobFixture({ mode: KnowledgeSynchronizationMode.MANUAL }),
      context: contextFixture(),
    });
    expect(result.valid).toBe(true);
  });
});

describe("MetadataValidator", () => {
  it("passes ordinary metadata", () => {
    expect(
      new MetadataValidator().validate({
        job: jobFixture(),
        context: contextFixture({ metadata: { foo: "bar" } }),
      }).valid,
    ).toBe(true);
  });

  it("flags a reserved metadata key", () => {
    const result = new MetadataValidator().validate({
      job: jobFixture(),
      context: contextFixture({ metadata: { ["constructor"]: "x" } }),
    });
    expect(result.valid).toBe(false);
  });
});

describe("RelationshipValidator", () => {
  it("passes a non-RELATIONSHIP_SYNC Job", () => {
    expect(
      new RelationshipValidator().validate({ job: jobFixture(), context: contextFixture() }).valid,
    ).toBe(true);
  });

  it("flags a RELATIONSHIP_SYNC Job with no collection", () => {
    const result = new RelationshipValidator().validate({
      job: jobFixture({ type: KnowledgeSynchronizationJobType.RELATIONSHIP_SYNC }),
      context: contextFixture(),
    });
    expect(result.valid).toBe(false);
  });

  it("passes a RELATIONSHIP_SYNC Job with a collection", () => {
    const result = new RelationshipValidator().validate({
      job: jobFixture({
        type: KnowledgeSynchronizationJobType.RELATIONSHIP_SYNC,
        collection: "collection-1",
      }),
      context: contextFixture(),
    });
    expect(result.valid).toBe(true);
  });
});

describe("VersionValidator", () => {
  it("passes a non-VERSION_SYNC Job", () => {
    expect(
      new VersionValidator().validate({ job: jobFixture(), context: contextFixture() }).valid,
    ).toBe(true);
  });

  it("flags a VERSION_SYNC Job with no Context version", () => {
    const result = new VersionValidator().validate({
      job: jobFixture({ type: KnowledgeSynchronizationJobType.VERSION_SYNC }),
      context: contextFixture(),
    });
    expect(result.valid).toBe(false);
  });

  it("passes a VERSION_SYNC Job with a Context version", () => {
    const result = new VersionValidator().validate({
      job: jobFixture({ type: KnowledgeSynchronizationJobType.VERSION_SYNC }),
      context: contextFixture({ version: "1.0.0" }),
    });
    expect(result.valid).toBe(true);
  });
});

describe("TenantValidator", () => {
  it("passes matching tenantIds", () => {
    expect(
      new TenantValidator().validate({ job: jobFixture(), context: contextFixture() }).valid,
    ).toBe(true);
  });

  it("flags a mismatch between job.tenantId and context.tenantId", () => {
    const result = new TenantValidator().validate({
      job: jobFixture({ tenantId: "a" }),
      context: contextFixture({ tenantId: "b" }),
    });
    expect(result.valid).toBe(false);
  });

  it("flags a blank job.tenantId even when context.tenantId matches", () => {
    const result = new TenantValidator().validate({
      job: { ...jobFixture(), tenantId: "" },
      context: contextFixture({ tenantId: "" }),
    });
    expect(result.valid).toBe(false);
  });
});

describe("WorkspaceValidator", () => {
  it("passes when neither workspaceId is set", () => {
    expect(
      new WorkspaceValidator().validate({
        job: jobFixture({ workspaceId: undefined }),
        context: contextFixture({ workspaceId: undefined }),
      }).valid,
    ).toBe(true);
  });

  it("flags a mismatch when both are set", () => {
    const result = new WorkspaceValidator().validate({
      job: jobFixture({ workspaceId: "a" }),
      context: contextFixture({ workspaceId: "b" }),
    });
    expect(result.valid).toBe(false);
  });
});

describe("ExecutionTokenValidator", () => {
  it("passes a well-formed token", () => {
    expect(
      new ExecutionTokenValidator().validate({ job: jobFixture(), context: contextFixture() })
        .valid,
    ).toBe(true);
  });

  it("flags a malformed token", () => {
    const result = new ExecutionTokenValidator().validate({
      job: jobFixture(),
      context: contextFixture({ token: "not-a-token" }),
    });
    expect(result.valid).toBe(false);
  });
});

describe("KnowledgeSynchronizationValidator", () => {
  it("passes a fully valid job/context pair", () => {
    const validator = new KnowledgeSynchronizationValidator();
    const result = validator.validate({ job: jobFixture(), context: contextFixture() });
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("aggregates issues from multiple stages without short-circuiting", () => {
    const validator = new KnowledgeSynchronizationValidator();
    const result = validator.validate({
      job: jobFixture({ providerId: "", sourceId: "" }),
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
    const validator = new KnowledgeSynchronizationValidator([extraStage]);
    const result = validator.validate({ job: jobFixture(), context: contextFixture() });
    expect(result.valid).toBe(false);
    expect(result.issues).toEqual([{ path: "extra", message: "always fails" }]);
  });
});
