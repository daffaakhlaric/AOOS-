import { ok } from "@aos/common";
import { describe, expect, it, vi } from "vitest";

import { SendBatch } from "../../../src/application/use-cases/SendBatch.js";
import type { IEventBatcher } from "../../../src/contracts/IEventBatcher.js";

describe("SendBatch", () => {
  it("delegates to IEventBatcher.flush", async () => {
    const batcher: IEventBatcher = { add: vi.fn(), flush: vi.fn(async () => ok([])) };
    const useCase = new SendBatch(batcher);
    const ctx = { tenantId: "t1", correlationId: "c1" };
    const result = await useCase.execute(ctx);
    expect(batcher.flush).toHaveBeenCalledWith(ctx);
    expect(result).toEqual(ok([]));
  });
});
