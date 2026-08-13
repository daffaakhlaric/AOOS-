import type { CreativeBrief } from "@aos/meta-ads-agent";
import { describe, expect, it, vi } from "vitest";

import type { KaiAgentService } from "../../../../src/application/services/KaiAgentService.js";
import { ProcessCreativeBrief } from "../../../../src/application/use-cases/ProcessCreativeBrief.js";
import { buildBrief } from "../../../fixtures/creativeBriefFixtures.js";
import { okResult } from "../../../helpers/mocks.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

describe("ProcessCreativeBrief", () => {
  it("delegates to KaiAgentService.processCreativeBrief", async () => {
    const processCreativeBrief = vi.fn().mockResolvedValue(okResult({ id: "pkg" }));
    const kaiAgentService = { processCreativeBrief } as unknown as KaiAgentService;
    const useCase = new ProcessCreativeBrief(kaiAgentService);

    const brief = buildBrief();
    const result = await useCase.execute(brief, "cid-1");

    expect(processCreativeBrief).toHaveBeenCalledWith(brief, "cid-1");
    expect(unwrap(result)).toEqual({ id: "pkg" });
  });

  it("rejects a brief with an empty formats array without calling KaiAgentService", async () => {
    const processCreativeBrief = vi.fn();
    const kaiAgentService = { processCreativeBrief } as unknown as KaiAgentService;
    const useCase = new ProcessCreativeBrief(kaiAgentService);

    // The real `CreativeBrief.create` already forbids an empty `formats` array, so this
    // structurally-shaped fake (cast to `CreativeBrief`) exercises Kai's own defensive re-check
    // (step 1 of the spec's pipeline) for a shape that can't otherwise be constructed.
    const emptyFormatsBrief = {
      id: { toString: () => "brief-empty-formats" },
      formats: [] as const,
    } as unknown as CreativeBrief;

    const error = unwrapErr(await useCase.execute(emptyFormatsBrief));
    expect(error.name).toBe("BriefValidationError");
    expect(processCreativeBrief).not.toHaveBeenCalled();
  });
});
