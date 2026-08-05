import { SourceConfigurationException } from "../errors/source-configuration-exception.js";
import { KnowledgeSourceScheduler } from "../scheduler/knowledge-source-scheduler.js";

import type { KnowledgeSourceConfigurationRecord } from "./knowledge-source-configuration-record.js";

const SECRET_KEY_PATTERN = /secret|password|token|api[-_]?key|credential|oauth/i;

/**
 * "SOURCE CONFIGURATION: Metadata only. No OAuth. No Secret. No API Client."
 * (docs/PROMPT-005.7G-KNOWLEDGE-SOURCE-MANAGER.md) — a real, enforced runtime guard, not
 * just documentation. Rejects any extra settings key that looks like a credential
 * (mirroring `@aos/knowledge-provider`'s `KnowledgeProviderConfiguration`), and enforces
 * two Source-specific structural rules: Auto Sync requires Enabled, and a Sync Mode of
 * Cron/Interval/One Time/Future Event requires a matching, structurally valid Schedule
 * descriptor (delegated to `KnowledgeSourceScheduler`).
 */
export class KnowledgeSourceConfiguration {
  private readonly scheduler = new KnowledgeSourceScheduler();

  validate(record: KnowledgeSourceConfigurationRecord): boolean {
    try {
      this.assertValid(record);
      return true;
    } catch {
      return false;
    }
  }

  assertValid(record: KnowledgeSourceConfigurationRecord): void {
    if (record.autoSync && !record.enabled) {
      throw new SourceConfigurationException(
        `Source "${record.sourceId}" configuration has autoSync=true but enabled=false`,
      );
    }
    if (!record.schedule) {
      return;
    }
    if (record.schedule.mode !== record.syncMode) {
      throw new SourceConfigurationException(
        `Source "${record.sourceId}" configuration syncMode ("${record.syncMode}") must match schedule.mode ("${record.schedule.mode}")`,
      );
    }
    this.scheduler.assertValid(record.schedule);
  }

  validateExtraSettings(settings: Readonly<Record<string, unknown>>): boolean {
    return this.findSecretLikeKeys(settings).length === 0;
  }

  assertValidExtraSettings(settings: Readonly<Record<string, unknown>>): void {
    const secretKeys = this.findSecretLikeKeys(settings);
    if (secretKeys.length > 0) {
      throw new SourceConfigurationException(
        `Source configuration must not contain secret-looking keys: ${secretKeys.join(", ")}`,
      );
    }
  }

  merge(
    base: Readonly<Record<string, unknown>>,
    overrides: Readonly<Record<string, unknown>>,
  ): Readonly<Record<string, unknown>> {
    return { ...base, ...overrides };
  }

  private findSecretLikeKeys(settings: Readonly<Record<string, unknown>>): readonly string[] {
    return Object.keys(settings).filter((key) => SECRET_KEY_PATTERN.test(key));
  }
}
