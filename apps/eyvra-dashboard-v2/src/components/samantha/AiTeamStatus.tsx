"use client";

import { useEffect, useState } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { StatusDot } from "@/components/common/StatusBadge";
import type { DecisionQueueState } from "@/components/command-center/useDecisionQueue";
import { formatNumber } from "@/lib/formatters";
import type { CreativePackageDto, OverviewResponseDto } from "@/types/dashboard.types";

import styles from "./AiTeamStatus.module.css";

const AGENT_COLOR_VAR: Record<string, string> = {
  SAMANTHA: "--samantha",
  KAI: "--kai",
  CLARA: "--clara",
};

export function AiTeamStatus({
  overview,
  decisionQueue,
}: {
  readonly overview: OverviewResponseDto;
  readonly decisionQueue: DecisionQueueState;
}): React.ReactElement {
  const [creative, setCreative] = useState<readonly CreativePackageDto[] | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/creative?limit=200")
      .then((res) =>
        res.ok ? (res.json() as Promise<{ packages: readonly CreativePackageDto[] }>) : null,
      )
      .then((body) => {
        if (!cancelled && body !== null) setCreative(body.packages);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const activeCampaigns = overview.campaigns?.activeCampaignsCount;
  const pendingDecisions = decisionQueue.entries?.length;
  const samanthaActions = overview.agentStatus.find((a) => a.agent === "SAMANTHA")?.actionsToday;

  const generating = creative?.filter((pkg) => pkg.status === "GENERATING").length;
  const pending = creative?.filter((pkg) => pkg.status === "PENDING").length;
  const kaiActions = overview.agentStatus.find((a) => a.agent === "KAI")?.actionsToday;

  const hotLeads = overview.leads?.hot;
  const warmLeads = overview.leads?.warm;
  const claraActions = overview.agentStatus.find((a) => a.agent === "CLARA")?.actionsToday;

  if (overview.agentStatus.length === 0) {
    return (
      <EmptyState
        title="Belum ada data status agent"
        description="Status operasional agent akan muncul di sini setelah agent mulai beraktivitas."
      />
    );
  }

  return (
    <ul className={styles.list} data-testid="cc-ai-team-status">
      <li className={styles.row}>
        <div className={styles.identity}>
          <StatusDot colorVar={AGENT_COLOR_VAR["SAMANTHA"] ?? "--text-secondary"} />
          <p className={styles.name}>Samantha</p>
        </div>
        <p className={styles.opLine} data-testid="ai-team-samantha-line">
          {activeCampaigns !== undefined
            ? `Memantau ${formatNumber(activeCampaigns)} campaign aktif`
            : "Data campaign belum tersedia"}
          {pendingDecisions !== undefined
            ? ` · ${formatNumber(pendingDecisions)} keputusan menunggu review`
            : ""}
          {samanthaActions !== undefined ? ` · ${formatNumber(samanthaActions)} aksi hari ini` : ""}
        </p>
      </li>
      <li className={styles.row}>
        <div className={styles.identity}>
          <StatusDot colorVar={AGENT_COLOR_VAR["KAI"] ?? "--text-secondary"} />
          <p className={styles.name}>Kai</p>
        </div>
        <p className={styles.opLine} data-testid="ai-team-kai-line">
          {generating !== undefined && pending !== undefined
            ? `${formatNumber(generating)} sedang digenerate · ${formatNumber(pending)} menunggu review`
            : "Data produksi Kai belum tersedia"}
          {kaiActions !== undefined ? ` · ${formatNumber(kaiActions)} aksi hari ini` : ""}
        </p>
      </li>
      <li className={styles.row}>
        <div className={styles.identity}>
          <StatusDot colorVar={AGENT_COLOR_VAR["CLARA"] ?? "--text-secondary"} />
          <p className={styles.name}>Clara</p>
        </div>
        <p className={styles.opLine} data-testid="ai-team-clara-line">
          {hotLeads !== undefined && warmLeads !== undefined
            ? `${formatNumber(hotLeads)} hot lead · ${formatNumber(warmLeads)} warm lead`
            : "Data leads belum tersedia"}
          {claraActions !== undefined ? ` · ${formatNumber(claraActions)} aksi hari ini` : ""}
        </p>
      </li>
    </ul>
  );
}
