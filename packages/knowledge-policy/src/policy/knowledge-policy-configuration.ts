import type { KnowledgePolicyConfigurationRecord } from "../domain/knowledge-policy-configuration-record.js";
import { PolicyConfigurationException } from "../errors/policy-configuration-exception.js";

/**
 * Validates and manages policy configuration records.
 */
export class KnowledgePolicyConfiguration {
  assertValid(configuration: KnowledgePolicyConfigurationRecord): void {
    if (configuration.maxRules !== undefined && configuration.maxRules < 1) {
      throw new PolicyConfigurationException(
        `Policy "${configuration.policyId}" configuration has invalid maxRules: ${String(configuration.maxRules)}`,
      );
    }
    if (configuration.maxAssignments !== undefined && configuration.maxAssignments < 1) {
      throw new PolicyConfigurationException(
        `Policy "${configuration.policyId}" configuration has invalid maxAssignments: ${String(configuration.maxAssignments)}`,
      );
    }
  }
}
