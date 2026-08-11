import { ValidationError } from "@aos/errors";
import type { PipeTransform } from "@nestjs/common";
import type { ZodTypeAny } from "zod";

/**
 * Validates a request body/query against a Zod schema, per-route (constructed with
 * `new ZodValidationPipe(schema)` in a controller's `@Body()`/`@Query()` parameter decorator,
 * NestJS's per-parameter pipe convention — not a single global schema). On failure, throws
 * `@aos/errors`' `ValidationError` (never a Nest built-in `BadRequestException`) so
 * `AaosExceptionFilter`'s existing `ValidationError -> 422` mapping is the single place that
 * decides the resulting status code, keeping one consistent error-to-HTTP-status pattern across
 * the whole app (see `filters/aaos-exception.filter.ts`'s class doc).
 */
export class ZodValidationPipe<TSchema extends ZodTypeAny> implements PipeTransform {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown): unknown {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; ");
      throw new ValidationError(`Request validation failed: ${details}`);
    }
    return parsed.data;
  }
}
