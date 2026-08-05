import type { KnowledgeSynchronizationContext } from "../context/knowledge-synchronization-context.js";
import type { KnowledgeSynchronizationJob } from "../domain/knowledge-synchronization-job.js";

/** A coarse-grained "may this Context run this Job at all" gate — permissive by default when unconfigured, mirroring `@aos/knowledge-retrieval`'s `IQueryPermissionChecker`. */
export interface ISynchronizationPermissionChecker {
  check(
    job: KnowledgeSynchronizationJob,
    context: KnowledgeSynchronizationContext,
  ): boolean | Promise<boolean>;
}
