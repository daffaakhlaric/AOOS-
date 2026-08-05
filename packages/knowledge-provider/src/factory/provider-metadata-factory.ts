import type { KnowledgeProviderCapabilityFlag } from "../domain/knowledge-provider-capability-flag.js";
import type { KnowledgeProviderCategory } from "../domain/knowledge-provider-category.js";
import { KnowledgeProviderStatus } from "../domain/knowledge-provider-status.js";
import type { ProviderMetadataRecord } from "../domain/provider-metadata-record.js";

export interface CreateProviderMetadataInput {
  readonly providerId: string;
  readonly providerName: string;
  readonly providerVersion: string;
  readonly providerCategory: KnowledgeProviderCategory;
  readonly providerAuthor?: string;
  readonly providerDescription?: string;
  readonly providerCapabilities?: readonly KnowledgeProviderCapabilityFlag[];
  readonly providerConfiguration?: Readonly<Record<string, unknown>>;
  readonly providerStatus?: KnowledgeProviderStatus;
  readonly providerPriority?: number;
  readonly providerPolicy?: string;
  readonly providerNamespace?: string;
  readonly providerIcon?: string;
  readonly providerTags?: readonly string[];
  readonly providerLabels?: readonly string[];
  readonly providerDependencies?: readonly string[];
  readonly providerLicense?: string;
  readonly providerHomepage?: string;
}

/** Builds a fresh `ProviderMetadataRecord`, defaulting optional list/record fields to empty. */
export class ProviderMetadataFactory {
  create(input: CreateProviderMetadataInput): ProviderMetadataRecord {
    return {
      providerId: input.providerId,
      providerName: input.providerName,
      providerVersion: input.providerVersion,
      providerCategory: input.providerCategory,
      providerAuthor: input.providerAuthor,
      providerDescription: input.providerDescription,
      providerCapabilities: [...(input.providerCapabilities ?? [])],
      providerConfiguration: { ...input.providerConfiguration },
      providerStatus: input.providerStatus ?? KnowledgeProviderStatus.ACTIVE,
      providerPriority: input.providerPriority ?? 0,
      providerPolicy: input.providerPolicy,
      providerNamespace: input.providerNamespace,
      providerIcon: input.providerIcon,
      providerTags: [...(input.providerTags ?? [])],
      providerLabels: [...(input.providerLabels ?? [])],
      providerDependencies: [...(input.providerDependencies ?? [])],
      providerLicense: input.providerLicense,
      providerHomepage: input.providerHomepage,
    };
  }
}
