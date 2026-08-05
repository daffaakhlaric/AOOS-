import {
  aiConsensusNodeManifest,
  aiCriticNodeManifest,
  aiDebateNodeManifest,
  aiPlannerNodeManifest,
  aiReasonNodeManifest,
  aiReflectionNodeManifest,
  aiSimulationNodeManifest,
  aiVotingNodeManifest,
  capabilityNodeManifest,
  humanApprovalNodeManifest,
  knowledgeSearchNodeManifest,
  promptNodeManifest,
} from "./ai-native/index.js";
import { BUILT_IN_NODE_MANIFESTS } from "./built-in-manifests.js";
import type { NodeManifest } from "./node-manifest.js";

/** Every built-in `NodeManifest` this package ships — 23 Flow/Human/AI/Knowledge/Memory Node Types plus the 12 AI-native contracts. `registry/node-registry.ts` registers these at construction time. */
export const ALL_NODE_MANIFESTS: readonly NodeManifest[] = [
  ...BUILT_IN_NODE_MANIFESTS,
  aiPlannerNodeManifest,
  aiReasonNodeManifest,
  aiReflectionNodeManifest,
  aiCriticNodeManifest,
  aiDebateNodeManifest,
  aiVotingNodeManifest,
  aiConsensusNodeManifest,
  aiSimulationNodeManifest,
  promptNodeManifest,
  knowledgeSearchNodeManifest,
  capabilityNodeManifest,
  humanApprovalNodeManifest,
];
