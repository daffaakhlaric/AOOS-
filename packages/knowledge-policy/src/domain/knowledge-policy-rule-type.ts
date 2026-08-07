/**
 * "RULE TYPES: Allow, Deny, Require, Optional, Conditional."
 * (docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md) — the exact 5 rule types from the prompt.
 */
export enum KnowledgePolicyRuleType {
  ALLOW = "allow",
  DENY = "deny",
  REQUIRE = "require",
  OPTIONAL = "optional",
  CONDITIONAL = "conditional",
}
