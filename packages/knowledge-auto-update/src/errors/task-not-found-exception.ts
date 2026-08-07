import { KnowledgeAutoUpdateException } from "./knowledge-auto-update-exception.js";

export class TaskNotFoundException extends KnowledgeAutoUpdateException {
  constructor(taskId: string) {
    super(`Knowledge update task not found: ${taskId}`, {
      code: "TASK_NOT_FOUND",
      context: { taskId },
    });
  }
}
