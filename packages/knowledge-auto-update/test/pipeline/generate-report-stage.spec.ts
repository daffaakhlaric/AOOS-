import { beforeEach, describe, expect, it } from "vitest";

import { GenerateReportStage } from "../../src/pipeline/stages/generate-report-stage.js";
import { KnowledgeUpdateReportType } from "../../src/types/report-type.js";
import { resetFixtureState } from "../helpers/fixtures.js";
import { makeContext } from "../helpers/pipeline-helpers.js";

describe("GenerateReportStage", () => {
  beforeEach(resetFixtureState);

  it("builds an UpdateSummary report and stores it in the registry", () => {
    const context = makeContext();
    const result = new GenerateReportStage().execute(context);
    expect(result.report?.type).toBe(KnowledgeUpdateReportType.UpdateSummary);
    expect(result.report?.data.jobId).toBe(context.job.id);
    expect(context.registry.getReport(result.report!.id)).toBe(result.report);
  });

  it("includes success=false when there is no result yet", () => {
    const context = makeContext();
    const result = new GenerateReportStage().execute(context);
    expect(result.report?.data.success).toBe(false);
  });
});
