import { z } from "zod";

import { baseManifestSchema } from "../../contracts/base-manifest.js";
import { RegistryKind } from "../../contracts/registry-kind.js";
import type { RegistryEventEmitter } from "../../events/registry-event-emitter.js";
import { Registry } from "../registry.js";

/** "Connector adalah adapter menuju external system" — docs/PROMPT-005.3A-REGISTRY-ENHANCEMENT.md Enhancement 2. No Connector Runtime and no actual API calls exist yet; this is manifest metadata only. */
const authenticationSchema = z.object({
  type: z.enum(["none", "api_key", "basic", "oauth2", "bearer_token", "mtls"]),
  /** Registry Secret Provider entry id holding the credential material — never the raw secret. */
  secretRef: z.string().optional(),
});

const oauthSchema = z.object({
  authorizationUrl: z.string().optional(),
  tokenUrl: z.string().optional(),
  scopes: z.array(z.string()).optional(),
});

const rateLimitSchema = z.object({
  requestsPerSecond: z.number().positive().optional(),
  burst: z.number().int().positive().optional(),
});

const retryPolicySchema = z.object({
  maxAttempts: z.number().int().positive().optional(),
  backoffMs: z.number().int().nonnegative().optional(),
});

export const connectorManifestSchema = baseManifestSchema.extend({
  protocol: z.enum(["http", "grpc", "websocket"]),
  endpoint_ref: z.string().optional(),
  authentication: authenticationSchema.optional(),
  oauth: oauthSchema.optional(),
  /** Registry Secret Provider entry id — duplicated top-level for connectors that need a secret outside `authentication` (e.g. a signing key). */
  secret_ref: z.string().optional(),
  /** Capability ids (see contracts/capability-namespace.ts) this Connector can serve as a provider for — cross-checked against the Capability Registry. */
  supported_capabilities: z.array(z.string()).optional(),
  /** Registry entry id (typically a Tool or health-check manifest) describing how to probe this Connector's health — no runtime check performed here. */
  health_check_ref: z.string().optional(),
  rate_limit: rateLimitSchema.optional(),
  retry_policy: retryPolicySchema.optional(),
  /** ISO 8601 duration or milliseconds-as-string (e.g. "PT30S", "30000") — format enforced by the future Connector Runtime, not here. */
  timeout: z.string().optional(),
});

export type ConnectorManifest = z.infer<typeof connectorManifestSchema>;

export function createConnectorRegistry(
  events?: RegistryEventEmitter,
): Registry<ConnectorManifest> {
  return new Registry<ConnectorManifest>({
    kind: RegistryKind.CONNECTOR,
    schema: connectorManifestSchema,
    events,
  });
}
