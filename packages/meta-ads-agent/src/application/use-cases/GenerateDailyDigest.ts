import type { Result } from "@aos/common";

import type { DailyDigestBuildInput } from "../../builders/DailyDigestBuilder.js";
import type { DailyDigest } from "../../domain/entities/DailyDigest.js";
import type { DecisionError } from "../../domain/errors/index.js";
import type { DigestService } from "../services/DigestService.js";

export interface GenerateDailyDigestInput extends DailyDigestBuildInput {
  readonly correlationId: string;
}

/** Generates DSS's plain-Indonesian daily performance summary (spec: "GenerateDailyDigest"). */
export class GenerateDailyDigest {
  constructor(private readonly digestService: DigestService) {}

  async execute(input: GenerateDailyDigestInput): Promise<Result<DailyDigest, DecisionError>> {
    const { correlationId, ...buildInput } = input;
    return this.digestService.generate(buildInput, correlationId);
  }
}
