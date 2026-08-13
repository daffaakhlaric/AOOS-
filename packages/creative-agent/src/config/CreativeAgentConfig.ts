import { ErrorCode, err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import { z } from "zod";

import { CreativeAgentError } from "../domain/errors/CreativeAgentError.js";

/** Per the spec's "Configuration" section. */
export interface CreativeAgentConfig {
  readonly tenantId: string;
  readonly agentName: "Kai";
  readonly defaultVideoModel: "veo3" | "veo3_fast";
  readonly defaultImageCount: number;
  readonly videoFallbackOnError: boolean;
  readonly maxGenerationWaitMs: number;
}

/**
 * Judgment call (mirroring `@aos/creative-connector`'s `CreativeConnectorConfig` docstring):
 * `@aos/config`'s `parseConfig` is shaped for parsing raw `process.env`-style string records,
 * which doesn't fit this config's already-typed numeric/literal fields. This schema instead
 * applies the same `Result`-returning discipline (Zod `safeParse`, never throw) directly to an
 * arbitrary input object.
 */
export const CreativeAgentConfigSchema = z.object({
  tenantId: z.string().min(1, "tenantId must not be empty"),
  agentName: z.literal("Kai").default("Kai"),
  defaultVideoModel: z.enum(["veo3", "veo3_fast"]).default("veo3_fast"),
  defaultImageCount: z.number().int().positive().default(3),
  videoFallbackOnError: z.boolean().default(true),
  maxGenerationWaitMs: z.number().int().positive().default(600_000),
});

export type CreativeAgentConfigInput = z.input<typeof CreativeAgentConfigSchema>;

export const DEFAULT_CREATIVE_AGENT_CONFIG: CreativeAgentConfigInput = {
  tenantId: "dss-motor",
};

/** Validates a raw config object, failing fast with `Result.err(CreativeAgentError)` rather than throwing. */
export function parseCreativeAgentConfig(
  input: unknown,
): Result<CreativeAgentConfig, CreativeAgentError> {
  const parsed = CreativeAgentConfigSchema.safeParse(input);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    return err(
      new CreativeAgentError(
        ErrorCode.VALIDATION_ERROR,
        `CreativeAgentConfig validation failed: ${details}`,
        { cause: new ValidationError(details) },
      ),
    );
  }
  return ok(parsed.data);
}
