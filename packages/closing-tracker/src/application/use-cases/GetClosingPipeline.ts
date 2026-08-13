import { err, ok, type Result } from "@aos/common";
import { ClosingType, type Closing } from "@aos/lead-store";

import type { IClosingAggregator } from "../../contracts/IClosingAggregator.js";
import { ClosingPipeline } from "../../domain/entities/ClosingPipeline.js";
import { ClosingTrackerError } from "../../domain/errors/ClosingTrackerError.js";
import { ConversionFunnel, type ReportPeriod } from "../../domain/value-objects/index.js";

export interface GetClosingPipelineInput {
  readonly period: ReportPeriod;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Test drive → SPK funnel for a period (spec: "GetClosingPipeline ← test drive → spk funnel"). Uses `@aos/lead-store`'s real `Closing.testDriveAt`/`.spkAt` fields. */
export class GetClosingPipeline {
  constructor(private readonly closingAggregator: IClosingAggregator) {}

  async execute(
    input: GetClosingPipelineInput,
  ): Promise<Result<ClosingPipeline, ClosingTrackerError>> {
    const datasetResult = await this.closingAggregator.aggregate(input.period);
    if (!datasetResult.ok) {
      return err(datasetResult.error);
    }
    const { closings } = datasetResult.value;

    const totalTestDrives = closings.filter((c) => c.closingType === ClosingType.TEST_DRIVE).length;
    const totalSpk = closings.filter((c) => c.closingType === ClosingType.SPK).length;
    const totalCancelled = closings.filter((c) => c.closingType === ClosingType.CANCELLED).length;
    const hotLeadCount = new Set(closings.map((c) => c.leadId.toString())).size;

    const avgDaysTestDriveToSpk = this.averageDaysTestDriveToSpk(closings);

    const funnelResult = ConversionFunnel.create({
      hotLeadCount,
      testDriveCount: totalTestDrives,
      spkCount: totalSpk,
    });
    /* v8 ignore start -- all 3 counts are non-negative integers by construction (array lengths / Set size), so ConversionFunnel.create can never fail here. */
    if (!funnelResult.ok) {
      return err(
        new ClosingTrackerError(funnelResult.error.message, { cause: funnelResult.error }),
      );
    }
    /* v8 ignore stop */

    const pipelineResult = ClosingPipeline.create({
      period: input.period,
      totalTestDrives,
      totalSpk,
      totalCancelled,
      avgDaysTestDriveToSpk,
      funnel: funnelResult.value,
    });
    /* v8 ignore start -- same non-negative-by-construction guarantee as above. */
    if (!pipelineResult.ok) {
      return err(
        new ClosingTrackerError(pipelineResult.error.message, { cause: pipelineResult.error }),
      );
    }
    /* v8 ignore stop */

    return ok(pipelineResult.value);
  }

  /** Average calendar days between `testDriveAt` and `spkAt`, for every lead (by `leadId`) whose closings include both timestamps. `0` when no lead has both. */
  private averageDaysTestDriveToSpk(closings: ReadonlyArray<Closing>): number {
    const testDriveByLead = new Map<string, Date>();
    const spkByLead = new Map<string, Date>();
    for (const closing of closings) {
      const leadId = closing.leadId.toString();
      if (closing.testDriveAt !== undefined) {
        testDriveByLead.set(leadId, closing.testDriveAt);
      }
      if (closing.spkAt !== undefined) {
        spkByLead.set(leadId, closing.spkAt);
      }
    }

    const diffs: number[] = [];
    for (const [leadId, testDriveAt] of testDriveByLead) {
      const spkAt = spkByLead.get(leadId);
      if (spkAt === undefined) {
        continue;
      }
      diffs.push((spkAt.getTime() - testDriveAt.getTime()) / MS_PER_DAY);
    }

    if (diffs.length === 0) {
      return 0;
    }
    return diffs.reduce((sum, d) => sum + d, 0) / diffs.length;
  }
}
