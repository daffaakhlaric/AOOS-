import { err, ErrorCode, ok } from "@aos/common";
import { describe, expect, it, vi } from "vitest";

import type { SimulationRunnerService } from "../../../../src/application/services/SimulationRunnerService.js";
import { GetSimulationResult } from "../../../../src/application/use-cases/GetSimulationResult.js";
import { SimulatorError } from "../../../../src/domain/errors/SimulatorError.js";

describe("GetSimulationResult", () => {
  it("delegates to SimulationRunnerService.getResult", () => {
    const getResult = vi.fn().mockReturnValue(ok("fake-result"));
    const runner = { getResult } as unknown as SimulationRunnerService;
    const useCase = new GetSimulationResult(runner);

    const result = useCase.execute("session-1");

    expect(getResult).toHaveBeenCalledWith("session-1");
    expect(result).toEqual(ok("fake-result"));
  });

  it("propagates a not-found error", () => {
    const getResult = vi
      .fn()
      .mockReturnValue(err(new SimulatorError(ErrorCode.NOT_FOUND, "no such session")));
    const runner = { getResult } as unknown as SimulationRunnerService;
    const useCase = new GetSimulationResult(runner);

    const result = useCase.execute("missing");

    expect(result.ok).toBe(false);
  });
});
