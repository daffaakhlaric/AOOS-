import { describe, expect, it } from "vitest";

import { QueueService } from "../../../src/application/services/QueueService.js";
import { GetAssignmentQueue } from "../../../src/application/use-cases/GetAssignmentQueue.js";
import { BranchManagerEvents } from "../../../src/domain/events/BranchManagerEvents.js";
import { BranchId } from "../../../src/domain/value-objects/BranchId.js";
import { createFakeLogger } from "../../helpers/logger.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { unwrap } from "../../helpers/result.js";

describe("GetAssignmentQueue", () => {
  it("returns the branch's queued leads in FIFO order", () => {
    const events = new BranchManagerEvents(createFakePublisher());
    const queueService = new QueueService(100, 86_400_000, events, createFakeLogger());
    unwrap(queueService.enqueue({ leadId: "lead-1", branchId: BranchId.BINTARO }));
    unwrap(queueService.enqueue({ leadId: "lead-2", branchId: BranchId.BINTARO }));

    const useCase = new GetAssignmentQueue(queueService);
    const result = unwrap(useCase.execute({ branchId: BranchId.BINTARO }));
    expect(result.map((l) => l.leadId)).toEqual(["lead-1", "lead-2"]);
  });

  it("returns an empty array for a branch with no queued leads", () => {
    const events = new BranchManagerEvents(createFakePublisher());
    const queueService = new QueueService(100, 86_400_000, events, createFakeLogger());
    const useCase = new GetAssignmentQueue(queueService);
    expect(unwrap(useCase.execute({ branchId: BranchId.BANDUNG }))).toEqual([]);
  });
});
