/**
 * Re-exported, not redeclared: the spec's folder tree lists `BranchId.ts` under
 * `domain/value-objects/` with the comment "import from @aos/branch-manager" — Clara represents a
 * DSS Motor branch and must use the exact same 4-member `BranchId` (`BINTARO | CINERE | UMUM |
 * BANDUNG`) that `@aos/branch-manager`'s `AssignLead`/`BranchRegistry` already establish as the
 * canonical branch identity, not a structurally-similar-but-distinct local enum.
 */
export { BranchId, ALL_BRANCH_IDS, fromBranch, toBranch } from "@aos/branch-manager";
