import type { KnowledgeBranchType } from "../domain/knowledge-branch-type.js";
import type { KnowledgeBranch } from "../domain/knowledge-branch.js";
import { generateId } from "../utils/id.js";

export interface CreateKnowledgeBranchInput {
  readonly name: string;
  readonly branchType: KnowledgeBranchType;
  readonly assetId: string;
  readonly tenantId: string;
  readonly workspaceId?: string;
  readonly sourceBranchId?: string;
  readonly headVersionId?: string;
  readonly createdBy?: string;
}

/** Builds a fresh `KnowledgeBranch` record with a generated `id` and `createdAt` stamped to now. */
export class KnowledgeVersionBranchFactory {
  create(input: CreateKnowledgeBranchInput): KnowledgeBranch {
    return {
      id: generateId(),
      name: input.name,
      branchType: input.branchType,
      assetId: input.assetId,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      sourceBranchId: input.sourceBranchId,
      headVersionId: input.headVersionId,
      createdBy: input.createdBy,
      createdAt: new Date().toISOString(),
    };
  }
}
