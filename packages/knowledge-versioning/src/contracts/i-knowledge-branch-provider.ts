import type { KnowledgeBranch } from "../domain/knowledge-branch.js";

/** Interface only — no implementation in this package. An external provider that materializes storage for a recorded `KnowledgeBranch`. */
export interface IKnowledgeBranchProvider {
  createBranch(branch: KnowledgeBranch): void | Promise<void>;
  deleteBranch(branchId: string): void | Promise<void>;
}
