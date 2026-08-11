import { err, type Result } from "@aos/common";
import type { ValidationError } from "@aos/errors";

import { AdMetrics } from "../domain/value-objects/AdMetrics.js";
import { Spend } from "../domain/value-objects/Spend.js";
import type { MetaInsightRow } from "../types/MetaApiTypes.js";
import { calculateActionBreakdown } from "../utils/D3Calculator.js";

/**
 * Maps a single (already Zod-validated) Meta `insights` row into an `AdMetrics` Value Object.
 * D3/D1(conversations)/leadForm come from `D3Calculator`; D2 and D5 are not derivable from the
 * Meta Marketing API today (see `D3Calculator`'s docstring) and are always `0` here — a
 * documented, current platform limitation, not an omission.
 */
export function mapInsightRowToMetrics(
  row: MetaInsightRow | undefined,
): Result<AdMetrics, ValidationError> {
  const spendResult = Spend.create(row?.spend !== undefined ? Number(row.spend) : 0);
  if (!spendResult.ok) {
    return err(spendResult.error);
  }

  const impressions = parseNonNegativeInt(row?.impressions);
  const reach = parseNonNegativeInt(row?.reach);
  const clicks = parseNonNegativeInt(row?.clicks);
  const { conversations, d3, leadForm } = calculateActionBreakdown(
    row?.actions,
    row?.messaging_conversation_started,
  );

  return AdMetrics.create({
    spend: spendResult.value,
    impressions,
    reach,
    clicks,
    conversations,
    d2: 0,
    d3,
    d5: 0,
    leadForm,
  });
}

function parseNonNegativeInt(raw: string | undefined): number {
  if (raw === undefined) {
    return 0;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}
