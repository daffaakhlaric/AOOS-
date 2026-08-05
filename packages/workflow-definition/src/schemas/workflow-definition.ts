import { z } from "zod";

import { compensationConfigSchema } from "../contracts/compensation-config.js";
import { retryConfigSchema } from "../contracts/retry-config.js";
import { TenantScope } from "../contracts/tenant-scope.js";
import { timeoutConfigSchema } from "../contracts/timeout-config.js";
import { labelsSchema, tagsSchema, workflowMetadataSchema } from "../metadata/workflow-metadata.js";
import { nodeSchema } from "../nodes/node.js";
import { transitionSchema } from "../transitions/transition.js";
import { variableDeclarationSchema } from "../variables/variable-declaration.js";

import { errorHandlingSchema } from "./error-handling.js";

/**
 * The Workflow Root (docs/PROMPT-005.6A-WORKFLOW-DEFINITION-LANGUAGE.md — "WORKFLOW
 * ROOT"). This schema only validates shape (every field's own type) — the structural
 * rules (exactly one Start node, every transition references a real node id, no cycles
 * outside Loop nodes, etc.) are `validator/`'s job, run separately after this schema
 * passes, mirroring `@aos/registry`/`@aos/scheduler`'s Schema-then-Business validation
 * split.
 */
export const workflowDefinitionSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(
      /^[a-z][a-z0-9_.-]*$/,
      "id must be lowercase, alphanumeric, '_', '.', or '-', starting with a letter",
    ),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "version must be a SemVer string (e.g. 1.0.0)"),
  namespace: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  labels: labelsSchema.optional(),
  tags: tagsSchema.optional(),
  tenantScope: z.nativeEnum(TenantScope).default(TenantScope.GLOBAL),
  tenantId: z.string().optional(),
  metadata: workflowMetadataSchema.optional(),
  variables: z.array(variableDeclarationSchema).optional(),
  input: z.record(z.string(), z.string()).optional(),
  output: z.record(z.string(), z.string()).optional(),
  nodes: z.array(nodeSchema).min(1),
  transitions: z.array(transitionSchema).optional(),
  errorHandling: errorHandlingSchema.optional(),
  compensation: compensationConfigSchema.optional(),
  retry: retryConfigSchema.optional(),
  timeout: timeoutConfigSchema.optional(),
  /** Event type names (e.g. `capability.resolved`) this Workflow may react to — a future Workflow Runtime's concern to subscribe, not this package's. */
  events: z.array(z.string()).optional(),
  /** `resource.action` strings — structurally checked by validator/permission-validator.ts. */
  permissions: z.array(z.string()).optional(),
});

export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;
