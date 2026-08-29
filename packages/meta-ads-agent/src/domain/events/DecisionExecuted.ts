/** Payload for `aaos.samantha.decision.executed`, emitted after an `AUTO_EXECUTE` decision is successfully executed via `@aos/meta-ads-connector`. */
export interface DecisionExecuted {
  readonly tenantId: string;
  readonly decisionId: string;
  readonly targetId: string;
  readonly targetType: string;
  readonly actionKind: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
