import type { ZodTypeAny } from "zod";

import type { BaseEventShape } from "../contracts/base-event.js";

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
}

/** One stage of the Event Validation pipeline (Schema/Version/Payload/Tenant/Permission). */
export interface IEventValidator {
  readonly name: string;
  validate(event: BaseEventShape, context: ValidationContext): ValidationResult;
}

export interface ValidationContext {
  /** Tenant ids the caller is authorized to publish/receive events for — undefined means "unscoped/platform caller". */
  readonly allowedTenantIds?: ReadonlySet<string>;
  /** Zod payload schemas keyed by event `type`, consulted by validator/payload-validator.ts. */
  readonly payloadSchemasByType?: ReadonlyMap<string, ZodTypeAny>;
  /** SemVer range `schemaVersion` must satisfy, consulted by validator/version-validator.ts. Unset means "any version accepted". */
  readonly supportedSchemaVersionRange?: string;
}
