import type { KnowledgeVersionConfigurationRecord } from "../../src/configuration/knowledge-version-configuration-record.js";

export function configurationFixture(
  overrides: Partial<KnowledgeVersionConfigurationRecord> = {},
): KnowledgeVersionConfigurationRecord {
  return {
    versionId: "version-1",
    autoSnapshot: false,
    immutablePublished: true,
    allowRollback: true,
    allowMerge: true,
    settings: {},
    ...overrides,
  };
}
