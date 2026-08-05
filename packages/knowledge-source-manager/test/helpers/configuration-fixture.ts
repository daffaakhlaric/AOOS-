import type { KnowledgeSourceConfigurationRecord } from "../../src/configuration/knowledge-source-configuration-record.js";
import { KnowledgeSourceScheduleMode } from "../../src/scheduler/knowledge-source-schedule-mode.js";

export function configurationFixture(
  overrides: Partial<KnowledgeSourceConfigurationRecord> = {},
): KnowledgeSourceConfigurationRecord {
  return {
    sourceId: "source-1",
    priority: 0,
    syncMode: KnowledgeSourceScheduleMode.MANUAL,
    enabled: false,
    autoSync: false,
    incremental: false,
    versioning: false,
    ...overrides,
  };
}
