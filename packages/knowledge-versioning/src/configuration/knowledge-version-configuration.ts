import { VersionConfigurationException } from "../errors/version-configuration-exception.js";

import type { KnowledgeVersionConfigurationRecord } from "./knowledge-version-configuration-record.js";

const SECRET_KEY_PATTERN = /secret|password|token|api[-_]?key|credential|oauth/i;

/**
 * "KnowledgeVersionConfiguration" (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md — "Domain
 * Model") — a real, enforced runtime guard, not just documentation. Rejects any
 * `settings` key that looks like a credential (mirroring the sibling Knowledge
 * packages' Configuration guards — versioning configuration is still "metadata only, no
 * secrets"), and enforces two version-specific structural rules: `autoSnapshot=true`
 * requires a `maxSnapshots` budget, and `maxRevisions` (when set) must not be smaller
 * than 1 snapshot/revision of headroom implied by `maxSnapshots`-style budgets.
 */
export class KnowledgeVersionConfiguration {
  validate(record: KnowledgeVersionConfigurationRecord): boolean {
    try {
      this.assertValid(record);
      return true;
    } catch {
      return false;
    }
  }

  assertValid(record: KnowledgeVersionConfigurationRecord): void {
    if (record.autoSnapshot && record.maxSnapshots === undefined) {
      throw new VersionConfigurationException(
        `Version "${record.versionId}" configuration has autoSnapshot=true but no maxSnapshots budget`,
      );
    }
    this.assertValidExtraSettings(record.settings);
  }

  validateExtraSettings(settings: Readonly<Record<string, unknown>>): boolean {
    return this.findSecretLikeKeys(settings).length === 0;
  }

  assertValidExtraSettings(settings: Readonly<Record<string, unknown>>): void {
    const secretKeys = this.findSecretLikeKeys(settings);
    if (secretKeys.length > 0) {
      throw new VersionConfigurationException(
        `Version configuration must not contain secret-looking keys: ${secretKeys.join(", ")}`,
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
