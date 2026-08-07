import { KnowledgeUpdateSession } from "../entities/knowledge-update-session.js";
import { generateId } from "../utils/id-generator.js";

/** Real Factory-pattern class building empty `KnowledgeUpdateSession` instances. */
export class KnowledgeUpdateSessionFactory {
  create(now: number): KnowledgeUpdateSession {
    return new KnowledgeUpdateSession({
      id: generateId("session"),
      taskIds: [],
      resultIds: [],
      startedAt: now,
      completedAt: undefined,
    });
  }
}
