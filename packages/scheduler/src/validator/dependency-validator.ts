import { ScheduleType } from "../contracts/schedule-type.js";
import type { CreateJobInput } from "../entities/job.js";

import type { IJobValidator, ValidationContext, ValidationResult } from "./i-job-validator.js";

function findCycle(
  edges: ReadonlyMap<string, readonly string[]>,
  start: string,
): string[] | undefined {
  const visited = new Set<string>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  let cycle: string[] | undefined;

  const visit = (id: string): void => {
    if (cycle || onStack.has(id)) {
      if (onStack.has(id)) {
        const cycleStart = stack.indexOf(id);
        cycle = [...stack.slice(cycleStart), id];
      }
      return;
    }
    if (visited.has(id)) {
      return;
    }
    visited.add(id);
    stack.push(id);
    onStack.add(id);
    for (const dep of edges.get(id) ?? []) {
      visit(dep);
      if (cycle) {
        break;
      }
    }
    stack.pop();
    onStack.delete(id);
  };

  visit(start);
  return cycle;
}

/** Dependency Validation — Job Dependency / Chain Dependency ids must exist, and adding them must not introduce a Cycle. */
export class DependencyValidator implements IJobValidator {
  readonly name = "dependency";

  validate(input: CreateJobInput, context: ValidationContext): ValidationResult {
    if (input.schedule.type !== ScheduleType.DEPENDENCY) {
      return { valid: true, issues: [] };
    }

    const existingJobIds = context.existingJobIds ?? new Set<string>();
    const missing = input.schedule.dependsOnJobIds.filter((id) => !existingJobIds.has(id));
    if (missing.length > 0) {
      return {
        valid: false,
        issues: [
          {
            path: "schedule.dependsOnJobIds",
            message: `Unknown dependency job id(s): ${missing.join(", ")}`,
          },
        ],
      };
    }

    const candidateId = context.candidateJobId ?? "__candidate__";
    const edges = new Map<string, readonly string[]>(context.existingDependenciesByJobId ?? []);
    edges.set(candidateId, input.schedule.dependsOnJobIds);

    const cycle = findCycle(edges, candidateId);
    if (cycle) {
      return {
        valid: false,
        issues: [
          {
            path: "schedule.dependsOnJobIds",
            message: `Circular dependency detected: ${cycle.join(" → ")}`,
          },
        ],
      };
    }

    return { valid: true, issues: [] };
  }
}
