import { z } from "zod";

import { KnowledgeProviderCapabilityFlag } from "./knowledge-provider-capability-flag.js";
import { KnowledgeProviderCategory } from "./knowledge-provider-category.js";
import { KnowledgeProviderStatus } from "./knowledge-provider-status.js";

/**
 * "PROVIDER METADATA: ProviderId, ProviderName, ProviderVersion, ProviderCategory,
 * ProviderAuthor, ProviderDescription, ProviderCapabilities, ProviderConfiguration,
 * ProviderStatus, ProviderPriority, ProviderPolicy, ProviderNamespace, ProviderIcon,
 * ProviderTags, ProviderLabels, ProviderDependencies, ProviderLicense,
 * ProviderHomepage." (docs/PROMPT-005.7F-KNOWLEDGE-PROVIDER.md) — the exact 18-field
 * list from the prompt. `configuration` carries only metadata-driven settings — "NO
 * OAuth. NO Secrets. NO API Clients." — enforced by `KnowledgeProviderConfiguration`.
 */
export const providerMetadataRecordSchema = z.object({
  providerId: z.string().min(1),
  providerName: z.string().min(1),
  providerVersion: z.string().min(1),
  providerCategory: z.nativeEnum(KnowledgeProviderCategory),
  providerAuthor: z.string().optional(),
  providerDescription: z.string().optional(),
  providerCapabilities: z.array(z.nativeEnum(KnowledgeProviderCapabilityFlag)),
  providerConfiguration: z.record(z.unknown()),
  providerStatus: z.nativeEnum(KnowledgeProviderStatus),
  providerPriority: z.number().int().nonnegative(),
  providerPolicy: z.string().optional(),
  providerNamespace: z.string().optional(),
  providerIcon: z.string().optional(),
  providerTags: z.array(z.string()),
  providerLabels: z.array(z.string()),
  providerDependencies: z.array(z.string()),
  providerLicense: z.string().optional(),
  providerHomepage: z.string().optional(),
});

export type ProviderMetadataRecord = z.infer<typeof providerMetadataRecordSchema>;
