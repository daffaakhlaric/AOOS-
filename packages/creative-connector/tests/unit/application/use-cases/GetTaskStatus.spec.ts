import { ok } from "@aos/common";
import { describe, expect, it } from "vitest";

import { GetTaskStatus } from "../../../../src/application/use-cases/GetTaskStatus.js";
import { TaskId } from "../../../../src/domain/value-objects/TaskId.js";
import { fakeCreativeClient } from "../../../helpers/fakeCreativeClient.js";
import { unwrap } from "../../../helpers/result.js";

describe("GetTaskStatus", () => {
  it("delegates to ICreativeClient.getTaskStatus with the taskId's string form", async () => {
    let receivedTaskId = "";
    const client = fakeCreativeClient({
      getTaskStatus: async (taskId) => {
        receivedTaskId = taskId;
        return ok({ taskId, successFlag: 1, videoUrl: "https://cdn.kie.ai/v.mp4" });
      },
    });
    const useCase = new GetTaskStatus(client);
    const status = unwrap(await useCase.execute(unwrap(TaskId.create("task_1"))));
    expect(receivedTaskId).toBe("task_1");
    expect(status.successFlag).toBe(1);
  });
});
