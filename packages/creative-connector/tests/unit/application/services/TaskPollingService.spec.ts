import { ok } from "@aos/common";
import { describe, expect, it } from "vitest";

import { TaskPollingService } from "../../../../src/application/services/TaskPollingService.js";
import type { CompletedTask, ITaskPoller } from "../../../../src/contracts/ITaskPoller.js";
import { MediaUrl } from "../../../../src/domain/value-objects/MediaUrl.js";
import { TaskId } from "../../../../src/domain/value-objects/TaskId.js";
import { unwrap } from "../../../helpers/result.js";

describe("TaskPollingService", () => {
  it("delegates to the underlying ITaskPoller with the same arguments", async () => {
    let receivedArgs: unknown[] = [];
    const taskId = unwrap(TaskId.create("task_1"));
    const completed: CompletedTask = {
      kind: "video",
      taskId,
      videoUrl: unwrap(MediaUrl.create("https://cdn.kie.ai/v.mp4")),
    };
    const poller: ITaskPoller = {
      pollUntilComplete: async (...args) => {
        receivedArgs = args;
        return ok(completed);
      },
    };
    const service = new TaskPollingService(poller);
    const result = unwrap(await service.pollUntilComplete(taskId, "video", 12345));
    expect(result).toBe(completed);
    expect(receivedArgs).toEqual([taskId, "video", 12345]);
  });
});
