import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { BaseEventShape } from "../../src/contracts/base-event.js";
import { EventCategory } from "../../src/contracts/event-category.js";
import { EventPriority } from "../../src/contracts/event-priority.js";
import { PayloadValidator } from "../../src/validator/payload-validator.js";
import { SchemaValidator } from "../../src/validator/schema-validator.js";
import { TenantValidator } from "../../src/validator/tenant-validator.js";
import { ValidationPipeline } from "../../src/validator/validation-pipeline.js";
import { VersionValidator } from "../../src/validator/version-validator.js";

function event(overrides: Partial<BaseEventShape> = {}): BaseEventShape {
  return {
    eventId: "550e8400-e29b-41d4-a716-446655440000",
    type: "agent.created",
    category: EventCategory.DOMAIN,
    correlationId: "corr-1",
    source: "agent-runtime",
    producer: "agent-service",
    timestamp: "2026-01-01T00:00:00.000Z",
    priority: EventPriority.NORMAL,
    version: "1.0.0",
    schemaVersion: "1.0.0",
    payload: { agentId: "content-manager" },
    ...overrides,
  };
}

describe("Validation Test — SchemaValidator", () => {
  it("passes a well-formed event", () => {
    expect(new SchemaValidator().validate(event(), {}).valid).toBe(true);
  });

  it("fails a malformed event (bad type)", () => {
    const result = new SchemaValidator().validate(event({ type: "no-namespace" }), {});
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.path).toBe("type");
  });
});

describe("Validation Test — VersionValidator", () => {
  it("passes when no supportedSchemaVersionRange is configured", () => {
    expect(new VersionValidator().validate(event(), {}).valid).toBe(true);
  });

  it("passes when schemaVersion satisfies the configured range", () => {
    const result = new VersionValidator().validate(event({ schemaVersion: "1.2.0" }), {
      supportedSchemaVersionRange: "^1.0.0",
    });
    expect(result.valid).toBe(true);
  });

  it("fails when schemaVersion does not satisfy the configured range", () => {
    const result = new VersionValidator().validate(event({ schemaVersion: "2.0.0" }), {
      supportedSchemaVersionRange: "^1.0.0",
    });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toContain("does not satisfy");
  });

  it("fails when the configured range itself is malformed", () => {
    const result = new VersionValidator().validate(event(), {
      supportedSchemaVersionRange: "not-a-range",
    });
    expect(result.valid).toBe(false);
  });
});

describe("Validation Test — PayloadValidator", () => {
  const payloadSchema = z.object({ agentId: z.string().min(1) });

  it("passes when the event type has no registered payload schema", () => {
    expect(new PayloadValidator().validate(event(), {}).valid).toBe(true);
  });

  it("passes when the payload satisfies its registered schema", () => {
    const result = new PayloadValidator().validate(event(), {
      payloadSchemasByType: new Map([["agent.created", payloadSchema]]),
    });
    expect(result.valid).toBe(true);
  });

  it("fails when the payload does not satisfy its registered schema", () => {
    const result = new PayloadValidator().validate(event({ payload: { agentId: "" } }), {
      payloadSchemasByType: new Map([["agent.created", payloadSchema]]),
    });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.path).toBe("payload.agentId");
  });
});

describe("Validation Test — TenantValidator", () => {
  it("passes a platform-scoped event (no tenantId) regardless of allowedTenantIds", () => {
    expect(
      new TenantValidator().validate(event(), { allowedTenantIds: new Set(["t-1"]) }).valid,
    ).toBe(true);
  });

  it("passes a tenant-scoped event when no allowedTenantIds is configured", () => {
    expect(new TenantValidator().validate(event({ tenantId: "t-1" }), {}).valid).toBe(true);
  });

  it("passes a tenant-scoped event for an allowed tenant", () => {
    expect(
      new TenantValidator().validate(event({ tenantId: "t-1" }), {
        allowedTenantIds: new Set(["t-1"]),
      }).valid,
    ).toBe(true);
  });

  it("fails a tenant-scoped event for a disallowed tenant", () => {
    const result = new TenantValidator().validate(event({ tenantId: "t-2" }), {
      allowedTenantIds: new Set(["t-1"]),
    });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toContain("t-2");
  });
});

describe("Validation Test — ValidationPipeline", () => {
  it("aggregates issues from every stage without short-circuiting", () => {
    const pipeline = new ValidationPipeline();
    const result = pipeline.run(event({ type: "bad", tenantId: "t-2" }), {
      allowedTenantIds: new Set(["t-1"]),
    });
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThanOrEqual(2);
  });

  it("passes a fully valid event through every stage", () => {
    const pipeline = new ValidationPipeline();
    expect(pipeline.run(event(), {}).valid).toBe(true);
  });

  it("accepts extra validators appended after the built-in stages", () => {
    const pipeline = new ValidationPipeline([
      {
        name: "custom",
        validate: () => ({ valid: false, issues: [{ path: "custom", message: "always fails" }] }),
      },
    ]);
    const result = pipeline.run(event(), {});
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.path === "custom")).toBe(true);
  });
});
