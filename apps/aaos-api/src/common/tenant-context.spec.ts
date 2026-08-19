import { describe, expect, it } from "vitest";

import { buildFakeExecutionContext, buildFakeRequest } from "../test-support/nest-mocks.js";

import {
  DEFAULT_TENANT_ID,
  TENANT_ID_HEADER,
  resolveTenantId,
  tenantIdFactory,
} from "./tenant-context.js";

describe("resolveTenantId", () => {
  it("reuses the caller's x-tenant-id header when present", () => {
    const request = buildFakeRequest({ headers: { [TENANT_ID_HEADER]: "propertyklik-demo" } });
    expect(resolveTenantId(request)).toBe("propertyklik-demo");
  });

  it("falls back to DEFAULT_TENANT_ID when no header is present", () => {
    const request = buildFakeRequest();
    expect(resolveTenantId(request)).toBe(DEFAULT_TENANT_ID);
  });

  it("ignores a non-string header value and falls back", () => {
    const request = buildFakeRequest({ headers: { [TENANT_ID_HEADER]: ["a", "b"] } });
    expect(resolveTenantId(request)).toBe(DEFAULT_TENANT_ID);
  });

  it("ignores an empty-string header value and falls back", () => {
    const request = buildFakeRequest({ headers: { [TENANT_ID_HEADER]: "" } });
    expect(resolveTenantId(request)).toBe(DEFAULT_TENANT_ID);
  });
});

describe("TenantId param decorator", () => {
  it("extracts the resolved tenant id from the execution context's request", () => {
    const request = buildFakeRequest({ headers: { [TENANT_ID_HEADER]: "propertyklik-demo" } });
    const context = buildFakeExecutionContext(request);
    expect(tenantIdFactory(undefined, context)).toBe("propertyklik-demo");
  });

  it("falls back to DEFAULT_TENANT_ID via the decorator when the request carries none", () => {
    const request = buildFakeRequest();
    const context = buildFakeExecutionContext(request);
    expect(tenantIdFactory("ignored-data", context)).toBe(DEFAULT_TENANT_ID);
  });
});

describe("TENANT_ID_HEADER", () => {
  it("is the lowercase x-tenant-id header name", () => {
    expect(TENANT_ID_HEADER).toBe("x-tenant-id");
  });
});
