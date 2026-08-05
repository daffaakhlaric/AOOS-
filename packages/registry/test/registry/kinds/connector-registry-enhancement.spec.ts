import { describe, expect, it } from "vitest";

import {
  connectorManifestSchema,
  createConnectorRegistry,
} from "../../../src/registry/kinds/connector-registry.js";

describe("Schema Test — connectorManifestSchema (005.3A Enhancement 2)", () => {
  it("accepts the full enriched shape", () => {
    const result = connectorManifestSchema.safeParse({
      id: "whatsapp-cloud-connector",
      version: "1.0.0",
      category: "connector",
      protocol: "http",
      endpoint_ref: "https://graph.facebook.com",
      authentication: { type: "oauth2", secretRef: "vault:whatsapp-token" },
      oauth: {
        authorizationUrl: "https://facebook.com/oauth/authorize",
        tokenUrl: "https://graph.facebook.com/oauth/access_token",
        scopes: ["whatsapp_business_messaging"],
      },
      secret_ref: "vault:whatsapp-signing-key",
      supported_capabilities: ["communication.send"],
      health_check_ref: "whatsapp-health-probe",
      rate_limit: { requestsPerSecond: 10, burst: 20 },
      retry_policy: { maxAttempts: 3, backoffMs: 500 },
      timeout: "PT30S",
    });
    expect(result.success).toBe(true);
  });

  it("still accepts a pre-005.3A minimal Connector manifest (backward compatible)", () => {
    const result = connectorManifestSchema.safeParse({
      id: "postiz-connector",
      version: "1.0.0",
      category: "social",
      protocol: "http",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown authentication type", () => {
    const result = connectorManifestSchema.safeParse({
      id: "x",
      version: "1.0.0",
      category: "connector",
      protocol: "http",
      authentication: { type: "carrier_pigeon" },
    });
    expect(result.success).toBe(false);
  });
});

describe("Unit Test — Connector Registry accepts enriched manifests end-to-end", () => {
  it("registers a Connector with authentication/rate_limit/retry_policy", async () => {
    const registry = createConnectorRegistry();
    const entry = await registry.register({
      id: "sap-connector",
      version: "1.0.0",
      category: "connector",
      protocol: "http",
      authentication: { type: "api_key" },
      rate_limit: { requestsPerSecond: 5 },
      retry_policy: { maxAttempts: 2 },
    });
    expect(entry.manifest.id).toBe("sap-connector");
  });
});
