import type { KnowledgeUpdateJob } from "../entities/knowledge-update-job.js";
import { KnowledgeUpdateTask } from "../entities/knowledge-update-task.js";
import { generateId } from "../utils/id-generator.js";

/** Real Factory-pattern class building `KnowledgeUpdateTask` instances from a due job. */
export class KnowledgeUpdateTaskFactory {
  create(job: KnowledgeUpdateJob, sessionId: string, now: number): KnowledgeUpdateTask {
    return new KnowledgeUpdateTask({
      id: generateId("task"),
      jobId: job.id,
      sessionId,
      updateType: job.updateType,
      targetId: job.targetId,
      payload: job.payload,
      previousPayload: job.previousPayload,
      attempt: job.attempt,
      createdAt: now,
    });
  }
}
