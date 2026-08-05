import { describe, expect, it } from "vitest";

import {
  FIXED_TEST_TIMESTAMP,
  fixedTestDate,
  generateTestUuid,
  SAMPLE_TENANT_ID,
  SAMPLE_TRACE_ID,
} from "../src/fixtures.js";
import { buildTestLogContext } from "../src/test-log-context.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("fixtures", () => {
  it("generateTestUuid produces a valid, unique UUID each call", () => {
    const a = generateTestUuid();
    const b = generateTestUuid();
    expect(a).toMatch(UUID_PATTERN);
    expect(a).not.toBe(b);
  });

  it("fixedTestDate matches FIXED_TEST_TIMESTAMP", () => {
    expect(fixedTestDate().toISOString()).toBe(FIXED_TEST_TIMESTAMP);
  });

  it("SAMPLE_TENANT_ID and SAMPLE_TRACE_ID are stable, distinct constants", () => {
    expect(SAMPLE_TENANT_ID).not.toBe(SAMPLE_TRACE_ID);
  });
});

describe("buildTestLogContext", () => {
  it("defaults to the sample tenant/trace IDs", () => {
    const context = buildTestLogContext();
    expect(context.tenantId).toBe(SAMPLE_TENANT_ID);
    expect(context.traceId).toBe(SAMPLE_TRACE_ID);
  });

  it("allows overriding individual fields", () => {
    const context = buildTestLogContext({ requestId: "req-1" });
    expect(context.requestId).toBe("req-1");
    expect(context.tenantId).toBe(SAMPLE_TENANT_ID);
  });
});
