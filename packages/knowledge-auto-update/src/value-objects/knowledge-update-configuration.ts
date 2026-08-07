export interface KnowledgeUpdateConfigurationProps {
  /** Max number of jobs the coordinator processes per `processDue` tick. */
  readonly maxConcurrentUpdatesPerTick: number;
  /** Whether the scheduler is allowed to auto-retry failed jobs. */
  readonly autoRetryEnabled: boolean;
  /** Whether staleness-driven auto-refresh is enabled. */
  readonly autoRefreshEnabled: boolean;
  /** Default policy id applied to jobs that don't specify one. */
  readonly defaultPolicyId: string;
}

/** Immutable top-level engine configuration. */
export class KnowledgeUpdateConfiguration {
  readonly maxConcurrentUpdatesPerTick: number;
  readonly autoRetryEnabled: boolean;
  readonly autoRefreshEnabled: boolean;
  readonly defaultPolicyId: string;

  constructor(props: KnowledgeUpdateConfigurationProps) {
    if (
      !Number.isInteger(props.maxConcurrentUpdatesPerTick) ||
      props.maxConcurrentUpdatesPerTick <= 0
    ) {
      throw new RangeError(
        "KnowledgeUpdateConfiguration: maxConcurrentUpdatesPerTick must be a positive integer",
      );
    }
    this.maxConcurrentUpdatesPerTick = props.maxConcurrentUpdatesPerTick;
    this.autoRetryEnabled = props.autoRetryEnabled;
    this.autoRefreshEnabled = props.autoRefreshEnabled;
    this.defaultPolicyId = props.defaultPolicyId;
    Object.freeze(this);
  }

  static default(defaultPolicyId: string): KnowledgeUpdateConfiguration {
    return new KnowledgeUpdateConfiguration({
      maxConcurrentUpdatesPerTick: 10,
      autoRetryEnabled: true,
      autoRefreshEnabled: true,
      defaultPolicyId,
    });
  }

  with(partial: Partial<KnowledgeUpdateConfigurationProps>): KnowledgeUpdateConfiguration {
    return new KnowledgeUpdateConfiguration({ ...this, ...partial });
  }
}
