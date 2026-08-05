import {
  generateKnowledgeRuntimeToken,
  type KnowledgeRuntimeToken,
} from "../token/knowledge-runtime-token.js";

/** Wraps `generateKnowledgeRuntimeToken()` behind the Factory Layer's naming convention. */
export class RuntimeTokenFactory {
  create(): KnowledgeRuntimeToken {
    return generateKnowledgeRuntimeToken();
  }
}
