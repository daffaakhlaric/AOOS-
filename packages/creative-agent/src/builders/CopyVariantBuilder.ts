import type { Result } from "@aos/common";
import type { ValidationError } from "@aos/errors";
import type { AdAngle } from "@aos/meta-ads-agent";

import { CopyVariant } from "../domain/entities/CopyVariant.js";

export interface CopyVariantBuilderInput {
  readonly variantLabel: "A" | "B" | "C";
  readonly angle: AdAngle;
  readonly primaryText: string;
  readonly headline: string;
  readonly callToAction: string;
}

/** Builder Pattern (spec "builders/CopyVariantBuilder.ts") — generates the `CopyVariant.id` (a UUID `CopyBuilder` doesn't need to think about) and delegates all validation to `CopyVariant.create`. */
export class CopyVariantBuilder {
  static build(input: CopyVariantBuilderInput): Result<CopyVariant, ValidationError> {
    return CopyVariant.create({
      id: crypto.randomUUID(),
      variantLabel: input.variantLabel,
      angle: input.angle,
      primaryText: input.primaryText,
      headline: input.headline,
      callToAction: input.callToAction,
    });
  }
}
