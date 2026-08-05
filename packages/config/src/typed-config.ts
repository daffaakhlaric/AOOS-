import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import type { z, ZodTypeAny } from "zod";

/**
 * Parses a raw environment record against a Zod schema, returning a typed Result rather than
 * throwing — configuration errors are expected/recoverable failures at process startup
 * (Constitution §16 Error Handling Standards), not exceptional runtime states.
 */
export function parseConfig<TSchema extends ZodTypeAny>(
  schema: TSchema,
  source: Record<string, string | undefined> = process.env,
): Result<z.infer<TSchema>, ValidationError> {
  const parsed = schema.safeParse(source);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    return err(new ValidationError(`Configuration validation failed: ${details}`));
  }

  return ok(parsed.data);
}
