/**
 * Interface only — no implementing class exists in this package (the source prompt lists
 * `KnowledgeRuntimeCheckpoint` as a Domain aggregate marked "interface only"). Finer
 * grained than a `KnowledgeRuntimeSnapshot`: an arbitrary mid-execution data capture a
 * future consumer could record, keyed by an arbitrary `stepId` rather than by
 * Instance-wide state.
 */
export interface IKnowledgeRuntimeCheckpoint {
  readonly id: string;
  readonly instanceToken: string;
  readonly stepId: string;
  readonly sequence: number;
  readonly createdAt: string;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface IKnowledgeRuntimeCheckpointStore {
  save(checkpoint: IKnowledgeRuntimeCheckpoint): Promise<void>;
  load(instanceToken: string): Promise<readonly IKnowledgeRuntimeCheckpoint[]>;
}
