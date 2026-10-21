"use client";
import { useEffect, useMemo, useState } from "react";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import type { StressTestRunDto } from "@/lib/stress-test";
import {
  POLL_INTERVAL_MS,
  isInProgressStatus,
  partialAsEvaluatedView,
  partialResultOf,
} from "@/lib/stress-test-progress";
import { evaluatedResultOf } from "@/lib/stress-test-result";
import { CompareRunsDrawer } from "./result/CompareRunsDrawer";
import { CreativeInfoCard } from "./result/CreativeInfoCard";
import { DimensionGrid } from "./result/DimensionGrid";
import { CopyEvaluatorCard, FactValidationPanel } from "./result/EvaluatorDetails";
import { ExperimentDraftCard } from "./result/ExperimentDraftCard";
import { FactValidationStatusCard } from "./result/FactValidationStatusCard";
import { ObjectionIntelligenceTable } from "./objections/ObjectionIntelligenceTable";
import { PersonaSimulationSection } from "./result/PersonaSimulationSection";
import { PrimaryRecommendationPanel } from "./result/PrimaryRecommendationPanel";
import { ResultHeader } from "./result/ResultHeader";
import { PartialResultBanner, ResultHero, RunStateCard } from "./result/ResultHero";
import { ResultStepper } from "./result/ResultStepper";
import { RunContextCard } from "./result/RunContextCard";
import { SendToKaiPanel } from "./result/SendToKaiPanel";
import { SimulationSummaryCard } from "./result/SimulationSummaryCard";
import { useRunContext } from "./result/useRunContext";
import styles from "./StressTestDetail.module.css";
import resultStyles from "./result/result.module.css";

/**
 * Creative Stress Test run detail — "decision workspace" layout (presentation only; the backend
 * evaluators/scoring are untouched). Every section reads real fields of the persisted run/result or
 * of existing real endpoints (listing, campaign workspace, run history); anything without a real
 * source renders as "—" / "N/A" / disabled. Legacy `WAITING_FOR_ENGINE`, `FAILED`, and
 * not-yet-evaluated runs render the header/context plus an honest state card. A FAILED run with a
 * real partial result renders only the sections that actually exist, under a "Hasil parsial" banner.
 * While the run is QUEUED/RUNNING the page polls every POLL_INTERVAL_MS (and only then).
 */
export function StressTestDetail({ runId }: { readonly runId: string }): React.ReactElement {
  const [run, setRun] = useState<StressTestRunDto | undefined>();
  const [error, setError] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const context = useRunContext(run);

  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    fetch(`/api/creative-stress-test/${encodeURIComponent(runId)}`, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json() as Promise<StressTestRunDto>;
      })
      .then((body) => {
        if (!controller.signal.aborted) setRun(body);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [runId]);

  const inProgress = run !== undefined && isInProgressStatus(run.status);
  useEffect(() => {
    if (!inProgress) return;
    const controller = new AbortController();
    let inFlight = false;
    const timer = setInterval(() => {
      if (inFlight) return;
      inFlight = true;
      fetch(`/api/creative-stress-test/${encodeURIComponent(runId)}`, {
        signal: controller.signal,
        cache: "no-store",
      })
        .then(async (r) => (r.ok ? ((await r.json()) as StressTestRunDto) : undefined))
        .then((body) => {
          if (!controller.signal.aborted && body !== undefined) setRun(body);
        })
        .catch(() => undefined)
        .finally(() => {
          inFlight = false;
        });
    }, POLL_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [inProgress, runId]);

  const result = run !== undefined && run.status !== "FAILED" ? evaluatedResultOf(run) : undefined;
  const partial = run !== undefined ? partialResultOf(run) : undefined;
  const partialView = useMemo(
    () => (partial !== undefined ? partialAsEvaluatedView(partial) : undefined),
    [partial],
  );

  return (
    <main className={styles.page}>
      <ResultHeader
        runId={runId}
        {...(run !== undefined ? { runName: run.name, onCompare: () => setCompareOpen(true) } : {})}
      />
      {error ? (
        <ErrorState message="Run belum dapat dimuat." />
      ) : run === undefined ? (
        <LoadingState processLabel="Memuat run…" />
      ) : (
        <div className={resultStyles.layout}>
          <div className={resultStyles.main}>
            <RunContextCard
              run={run}
              {...(context.listing !== undefined ? { listing: context.listing } : {})}
              loading={context.loading}
            />
            {result !== undefined ? (
              <>
                <ResultStepper />
                <ResultHero run={run} result={result} />
                <PrimaryRecommendationPanel result={result} />
                <DimensionGrid result={result} />
                <PersonaSimulationSection run={run} result={result} />
                <div id="objection-intelligence">
                  <ObjectionIntelligenceTable run={run} result={result} />
                </div>
                <CopyEvaluatorCard evaluation={result.copyEvaluation} />
                <FactValidationPanel factCheck={result.factCheck} />
              </>
            ) : partial !== undefined && partialView !== undefined ? (
              <>
                <PartialResultBanner run={run} partial={partial} />
                {partial.personaCritiques.some((p) => p.ok) ? (
                  <>
                    <PersonaSimulationSection run={run} result={partialView} />
                    <ObjectionIntelligenceTable run={run} result={partialView} />
                  </>
                ) : null}
                {partial.copyEvaluation?.ok === true ? (
                  <CopyEvaluatorCard evaluation={partial.copyEvaluation} />
                ) : null}
                {partial.factCheck?.status === "CHECKED" ? (
                  <FactValidationPanel factCheck={partial.factCheck} />
                ) : null}
              </>
            ) : (
              <RunStateCard run={run} />
            )}
          </div>
          <aside className={resultStyles.rail}>
            <CreativeInfoCard info={context.creativeInfo} loading={context.loading} />
            {result !== undefined ? (
              <>
                <FactValidationStatusCard
                  factCheck={result.factCheck}
                  {...(context.listingId !== undefined ? { listingId: context.listingId } : {})}
                />
                <SimulationSummaryCard
                  run={run}
                  result={result}
                  listingLoaded={context.listing !== undefined}
                  creativeResolved={context.creativeInfo.creatives.length > 0}
                />
                {run.status === "COMPLETED" ? <SendToKaiPanel run={run} result={result} /> : null}
                <ExperimentDraftCard />
              </>
            ) : null}
          </aside>
          <CompareRunsDrawer
            open={compareOpen}
            onClose={() => setCompareOpen(false)}
            current={run}
          />
        </div>
      )}
    </main>
  );
}
