import { KnowledgeGraphException } from "./knowledge-graph-exception.js";

/** Thrown when a `GraphConfiguration` record is malformed (e.g. negative `maxTraversalDepth`). */
export class GraphConfigurationException extends KnowledgeGraphException {
  constructor(message: string, context?: Readonly<Record<string, unknown>>) {
    super(message, { code: "GRAPH_CONFIGURATION_INVALID", context });
  }
}
