"use client";
import { useState } from "react";
import { Card } from "@/components/common/Card";
import { Drawer } from "@/components/common/Drawer";
import {
  OBJECTION_SEVERITY_LABELS,
  type StressTestEvaluatedResultDto,
  type StressTestPersonaAttemptDto,
  type StressTestRunDto,
} from "@/lib/stress-test";
import { PERSONA_PRESET_TAGS, SEVERITY_TONE, summarizePersona } from "@/lib/stress-test-result";
import { EvidenceBadge, ToneBadge } from "./EvidenceBadge";
import styles from "./result.module.css";

export const PERSONA_DISCLAIMER =
  "Hasil berikut menggunakan persona simulasi AI. Ini bukan pernyataan dari pembeli nyata.";

function ListBlock({
  title,
  items,
}: {
  readonly title: string;
  readonly items: readonly string[];
}): React.ReactElement | null {
  if (items.length === 0) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <span className={styles.sectionLabel}>{title}</span>
      <ul className={styles.plainList}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function PersonaCard({
  attempt,
  onOpen,
}: {
  readonly attempt: StressTestPersonaAttemptDto;
  readonly onOpen: () => void;
}): React.ReactElement {
  const tag = PERSONA_PRESET_TAGS[attempt.personaId];
  if (!attempt.ok || attempt.critique === undefined) {
    return (
      <div className={styles.personaCard} data-testid={`stress-test-persona-${attempt.personaId}`}>
        <div className={styles.personaHeader}>
          <strong>{attempt.personaLabel}</strong>
          <ToneBadge tone="neutral">{tag}</ToneBadge>
        </div>
        <p className={styles.failureNote}>
          Simulasi gagal: {attempt.failureReason ?? "alasan tidak diketahui"}
        </p>
      </div>
    );
  }
  const summary = summarizePersona(attempt);
  return (
    <button
      type="button"
      className={styles.personaCard}
      onClick={onOpen}
      data-testid={`stress-test-persona-${attempt.personaId}`}
    >
      <div className={styles.personaHeader}>
        <strong>{attempt.personaLabel}</strong>
        <ToneBadge tone="info">{tag}</ToneBadge>
      </div>
      <p className={styles.personaReaction}>&ldquo;{attempt.critique.narrativeReaction}&rdquo;</p>
      {summary.topAttraction !== undefined ? (
        <div className={styles.personaLine}>
          <b>Menarik</b>
          <span>{summary.topAttraction}</span>
        </div>
      ) : null}
      {summary.topConfusion !== undefined ? (
        <div className={styles.personaLine}>
          <b>Bingung</b>
          <span>{summary.topConfusion}</span>
        </div>
      ) : null}
      {summary.topObjection !== undefined ? (
        <div className={styles.personaLine}>
          <b>Keberatan</b>
          <span>
            {summary.topObjection.objection}{" "}
            <ToneBadge tone={SEVERITY_TONE[summary.topObjection.severity]}>
              {OBJECTION_SEVERITY_LABELS[summary.topObjection.severity]}
            </ToneBadge>
          </span>
        </div>
      ) : null}
      {summary.topIntentDriver !== undefined ? (
        <div className={styles.personaLine}>
          <b>Peningkat intent</b>
          <span>{summary.topIntentDriver}</span>
        </div>
      ) : null}
      <span className={styles.muted}>Lihat detail →</span>
    </button>
  );
}

/**
 * "Simulasi Persona Pembeli" — the simulation disclaimer is rendered ONCE at the section header
 * (not repeated per card); compact cards per real persona attempt; click opens the full real
 * critique. Preset tags describe the configured preset, not a measured segment.
 */
export function PersonaSimulationSection({
  run,
  result,
}: {
  readonly run: StressTestRunDto;
  readonly result: StressTestEvaluatedResultDto;
}): React.ReactElement {
  const [openId, setOpenId] = useState<string | undefined>();
  const open = result.personaCritiques.find((p) => p.personaId === openId);
  const notSimulated = Math.max(0, run.personaIds.length - result.personaCritiques.length);

  return (
    <Card title="Simulasi Persona Pembeli" testId="stress-test-persona-results-card">
      <div className={styles.disclaimer} data-testid="stress-test-persona-disclaimer">
        <EvidenceBadge kind="SIMULATED" /> {PERSONA_DISCLAIMER}
      </div>
      {result.personaCritiques.length === 0 ? (
        <p className={styles.muted}>Tidak ada persona yang disimulasikan pada run ini.</p>
      ) : (
        <div className={styles.personaGrid}>
          {result.personaCritiques.map((attempt) => (
            <PersonaCard
              key={attempt.personaId}
              attempt={attempt}
              onOpen={() => setOpenId(attempt.personaId)}
            />
          ))}
        </div>
      )}
      {notSimulated > 0 ? (
        <p className={styles.note}>
          {notSimulated} persona yang dipilih tidak disimulasikan karena batas jumlah persona pada
          mode ini.
        </p>
      ) : null}
      <p className={styles.note}>
        Label persona menggambarkan fokus preset yang dikonfigurasi, bukan segmen pembeli terukur.
      </p>
      <Drawer
        open={open !== undefined}
        onClose={() => setOpenId(undefined)}
        title={open !== undefined ? `Persona: ${open.personaLabel}` : "Persona"}
      >
        {open?.critique !== undefined ? (
          <div data-testid="stress-test-persona-drawer">
            <div className={styles.badgeRow} style={{ marginBottom: 10 }}>
              <ToneBadge tone="info">{PERSONA_PRESET_TAGS[open.personaId]}</ToneBadge>
              <EvidenceBadge kind="SIMULATED" />
            </div>
            <p style={{ fontStyle: "italic" }}>&ldquo;{open.critique.narrativeReaction}&rdquo;</p>
            <ListBlock title="Menarik perhatian" items={open.critique.attracts} />
            <ListBlock title="Membingungkan" items={open.critique.confusions} />
            {open.critique.objections.length > 0 ? (
              <div style={{ marginBottom: 10 }}>
                <span className={styles.sectionLabel}>
                  Keberatan (simulasi, bukan frekuensi terukur)
                </span>
                <ul className={styles.plainList}>
                  {open.critique.objections.map((o) => (
                    <li key={o.objection}>
                      {o.objection}{" "}
                      <ToneBadge tone={SEVERITY_TONE[o.severity]}>
                        {OBJECTION_SEVERITY_LABELS[o.severity]}
                      </ToneBadge>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <ListBlock title="Peningkat intent" items={open.critique.intentDrivers} />
          </div>
        ) : null}
      </Drawer>
    </Card>
  );
}
