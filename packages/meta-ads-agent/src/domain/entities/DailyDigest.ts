import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

export interface DailyDigestTopPerformer {
  readonly label: string;
  readonly rphChatIDR: number;
  readonly conversations: number;
}

export interface DailyDigestProps {
  readonly tenantId: string;
  readonly date: Date;
  readonly targetHotLeads: number;
  readonly currentHotLeads: number;
  readonly progressPercentage: number;
  readonly forecastedHotLeads: number;
  readonly onTrack: boolean;
  readonly budgetAllocatedIDR: number;
  readonly budgetSpentIDR: number;
  readonly budgetSpentPercentage: number;
  readonly burnRateIDR: number;
  readonly budgetRemainingIDR: number;
  readonly daysOfBudgetRemaining: number;
  readonly autoExecutedSummaryLines: ReadonlyArray<string>;
  readonly creativeBriefSummaryLines: ReadonlyArray<string>;
  readonly pendingEscalationSummaryLines: ReadonlyArray<string>;
  readonly topPerformers: ReadonlyArray<DailyDigestTopPerformer>;
  readonly weeklyRecommendation: string;
  readonly text: string;
}

/** DSS Motor's plain-Indonesian daily performance summary, produced by `DailyDigestBuilder`/`GenerateDailyDigest`. */
export class DailyDigest {
  private constructor(private readonly props: DailyDigestProps) {}

  static create(props: DailyDigestProps): Result<DailyDigest, ValidationError> {
    if (typeof props.tenantId !== "string" || props.tenantId.trim().length === 0) {
      return err(new ValidationError("DailyDigest.tenantId must be a non-empty string"));
    }
    if (typeof props.text !== "string" || props.text.trim().length === 0) {
      return err(new ValidationError("DailyDigest.text must be a non-empty string"));
    }
    return ok(
      new DailyDigest({
        ...props,
        autoExecutedSummaryLines: [...props.autoExecutedSummaryLines],
        creativeBriefSummaryLines: [...props.creativeBriefSummaryLines],
        pendingEscalationSummaryLines: [...props.pendingEscalationSummaryLines],
        topPerformers: [...props.topPerformers],
      }),
    );
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get date(): Date {
    return this.props.date;
  }

  get targetHotLeads(): number {
    return this.props.targetHotLeads;
  }

  get currentHotLeads(): number {
    return this.props.currentHotLeads;
  }

  get progressPercentage(): number {
    return this.props.progressPercentage;
  }

  get forecastedHotLeads(): number {
    return this.props.forecastedHotLeads;
  }

  get onTrack(): boolean {
    return this.props.onTrack;
  }

  get budgetAllocatedIDR(): number {
    return this.props.budgetAllocatedIDR;
  }

  get budgetSpentIDR(): number {
    return this.props.budgetSpentIDR;
  }

  get budgetSpentPercentage(): number {
    return this.props.budgetSpentPercentage;
  }

  get burnRateIDR(): number {
    return this.props.burnRateIDR;
  }

  get budgetRemainingIDR(): number {
    return this.props.budgetRemainingIDR;
  }

  get daysOfBudgetRemaining(): number {
    return this.props.daysOfBudgetRemaining;
  }

  get autoExecutedSummaryLines(): ReadonlyArray<string> {
    return this.props.autoExecutedSummaryLines;
  }

  get creativeBriefSummaryLines(): ReadonlyArray<string> {
    return this.props.creativeBriefSummaryLines;
  }

  get pendingEscalationSummaryLines(): ReadonlyArray<string> {
    return this.props.pendingEscalationSummaryLines;
  }

  get topPerformers(): ReadonlyArray<DailyDigestTopPerformer> {
    return this.props.topPerformers;
  }

  get weeklyRecommendation(): string {
    return this.props.weeklyRecommendation;
  }

  get text(): string {
    return this.props.text;
  }
}
