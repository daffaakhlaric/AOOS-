"use client";

import { useState } from "react";
import Link from "next/link";

import { Card } from "@/components/common/Card";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { GrowthObjectiveHero } from "@/components/growth/GrowthObjectiveHero";
import { AiTeamPulse } from "@/components/samantha/AiTeamPulse";
import type { OverviewResponseDto, OverviewTimeseriesPointDto } from "@/types/dashboard.types";

import { ActiveExperimentsCard } from "./ActiveExperimentsCard";
import { ActivityFeed } from "./ActivityFeed";
import { KaiProductionCard } from "./KaiProductionCard";
import { KpiStrip } from "./KpiStrip";
import { NeedsAttentionSummary } from "./NeedsAttentionSummary";
import { OpportunitySummary } from "./OpportunitySummary";
import { PerformanceOverviewChart } from "./PerformanceOverviewChart";
import { SamanthaDecisionQueue } from "./SamanthaDecisionQueue";
import styles from "./CommandCenterClient.module.css";
import { useAccountSummary } from "./useAccountSummary";
import { useDecisionQueue } from "./useDecisionQueue";
import { useOverview } from "./useOverview";

export function CommandCenterClient(): React.ReactElement {
  const { data, error } = useOverview();
  const [timeseriesPoints, setTimeseriesPoints] = useState<
    readonly OverviewTimeseriesPointDto[] | undefined
  >(undefined);

  if (error !== undefined) {
    return <ErrorState message={error} testId="command-center-error" />;
  }
  if (data === undefined) {
    return (
      <div className={styles.page} data-testid="command-center-loading" aria-busy="true">
        {[
          styles.areaGrowth,
          styles.areaKpi,
          styles.areaPulse,
          styles.areaNeeds,
          styles.areaOpp,
          styles.areaPerf,
          styles.areaDecisions,
          styles.areaActivity,
          styles.areaExperiments,
          styles.areaKai,
        ].map((area, index) => (
          <div className={area} key={index}>
            <Card>
              <LoadingState
                processLabel={
                  index === 0 ? "Samantha sedang memuat Command Center..." : "Memuat..."
                }
              />
            </Card>
          </div>
        ))}
      </div>
    );
  }

  return (
    <CommandCenterBody
      data={data}
      timeseriesPoints={timeseriesPoints}
      onTimeseries={setTimeseriesPoints}
    />
  );
}

function CommandCenterBody({
  data,
  timeseriesPoints,
  onTimeseries,
}: {
  readonly data: OverviewResponseDto;
  readonly timeseriesPoints: readonly OverviewTimeseriesPointDto[] | undefined;
  readonly onTimeseries: (points: readonly OverviewTimeseriesPointDto[]) => void;
}): React.ReactElement {
  const accountSummary = useAccountSummary();
  const decisionQueue = useDecisionQueue(accountSummary.data);

  return (
    <div className={styles.page} data-testid="command-center">
      <div className={styles.areaGrowth}>
        <GrowthObjectiveHero />
      </div>

      <div className={styles.areaKpi}>
        <KpiStrip overview={data} timeseriesPoints={timeseriesPoints} />
      </div>
      <div className={styles.areaPulse}>
        <AiTeamPulse summary={accountSummary.data} decisionQueue={decisionQueue} />
      </div>

      <div className={styles.areaDecisions}>
        <Card
          title="Samantha Attention Queue"
          testId="cc-decision-queue-card"
          variant="hero"
          /* Reference design's header link. Points at the real, already-built `/campaigns` page —
             the only real surface that lists every campaign this queue ranks a capped slice of. */
          action={
            <Link href="/campaigns" className={styles.cardHeaderLink}>
              View All →
            </Link>
          }
        >
          <SamanthaDecisionQueue
            queue={decisionQueue}
            campaigns={accountSummary.data?.campaigns ?? []}
            error={accountSummary.error}
          />
        </Card>
      </div>

      <div className={styles.areaNeeds}>
        <Card>
          <NeedsAttentionSummary summary={accountSummary.data} error={accountSummary.error} />
        </Card>
      </div>
      <div className={styles.areaOpp}>
        <Card>
          <OpportunitySummary summary={accountSummary.data} error={accountSummary.error} />
        </Card>
      </div>
      <div className={styles.areaPerf}>
        <Card title="Performance Overview" variant="compact">
          <PerformanceOverviewChart onPointsLoaded={onTimeseries} />
        </Card>
      </div>

      <div className={styles.areaExperiments}>
        <Card title="Active Experiments" variant="compact">
          <ActiveExperimentsCard />
        </Card>
      </div>
      <div className={styles.areaKai}>
        <Card title="Kai Creative Production" variant="compact">
          <KaiProductionCard />
        </Card>
      </div>

      <div className={styles.areaActivity}>
        {/* No `Card title` here on purpose: per the design reference the "Agent Activity" heading
            and the real agent filter share ONE header row, so `ActivityFeed` owns that row (the
            filter's state lives inside it). */}
        <Card variant="compact">
          <ActivityFeed activities={data.activities} />
        </Card>
      </div>
    </div>
  );
}

export default CommandCenterClient;
