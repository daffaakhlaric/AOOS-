"use client";

import { useEffect, useRef, useState } from "react";

import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { subscribeToLeadChat } from "@/lib/realtime";
import type { LeadDetailDto, MessageDto, ScoringEventDto } from "@/types/dashboard.types";

import styles from "./LeadChatRoom.module.css";

export interface LeadChatRoomProps {
  readonly leadId: string;
}

function waLink(phone: string): string {
  return `https://wa.me/${phone.replace(/^\+/, "")}`;
}

type TimelineItem =
  | { readonly kind: "message"; readonly at: number; readonly message: MessageDto }
  | { readonly kind: "scoring"; readonly at: number; readonly event: ScoringEventDto };

function buildTimeline(
  messages: readonly MessageDto[],
  scoringEvents: readonly ScoringEventDto[],
): readonly TimelineItem[] {
  const items: TimelineItem[] = [
    ...messages.map((message): TimelineItem => ({
      kind: "message",
      at: Date.parse(message.sentAt ?? message.createdAt),
      message,
    })),
    ...scoringEvents.map((event): TimelineItem => ({
      kind: "scoring",
      at: Date.parse(event.createdAt),
      event,
    })),
  ];
  return items.sort((a, b) => a.at - b.at);
}

function bubbleClass(message: MessageDto): string {
  if (message.direction === "INCOMING") {
    return `${styles.bubbleRow} ${styles.bubbleLead}`;
  }
  if (message.senderType === "SALES_HUMAN") {
    return `${styles.bubbleRow} ${styles.bubbleOutgoing} ${styles.bubbleSales}`;
  }
  if (message.senderType === "MANAGER_INTERVENTION") {
    return `${styles.bubbleRow} ${styles.bubbleOutgoing} ${styles.bubbleManager}`;
  }
  return `${styles.bubbleRow} ${styles.bubbleOutgoing} ${styles.bubbleJessy}`;
}

function senderLabel(message: MessageDto): string {
  if (message.direction === "INCOMING") {
    return "Lead";
  }
  if (message.senderType === "SALES_HUMAN") {
    return message.senderName ?? "Sales";
  }
  if (message.senderType === "MANAGER_INTERVENTION") {
    return `🤖 Jessy (intervensi — ${message.senderName ?? "Manager"})`;
  }
  return "🤖 Jessy";
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * `/leads/[leadId]` — manager chat room (AAOS-CHAT-ROOM-JESSY). Split panel: LEFT (60%) is the
 * real Jessy × Lead conversation with a manual "intervene as Jessy" send form (persisted
 * `sender_type = 'MANAGER_INTERVENTION'`, never `'JESSY'` — see `aaos-api`'s `intervene.dto.ts`);
 * RIGHT (40%) is lead info, score + real `scoring_events` timeline, sales assignment, and actions.
 * System events (scoring/hot) are derived by merging the real `messages` + `scoring_events` rows —
 * never a fabricated event. Live-updates via Supabase Realtime (`lib/realtime.ts`).
 */
export function LeadChatRoom({ leadId }: LeadChatRoomProps): React.ReactElement {
  const [lead, setLead] = useState<LeadDetailDto | undefined>(undefined);
  const [scoringEvents, setScoringEvents] = useState<readonly ScoringEventDto[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [interveneText, setInterveneText] = useState("");
  const [sendStatus, setSendStatus] = useState<"idle" | "sending" | "error">("idle");
  const [sendError, setSendError] = useState<string | undefined>(undefined);
  const seenMessageIds = useRef(new Set<string>());
  const seenScoringIds = useRef(new Set<string>());

  useEffect(() => {
    fetch(`/api/leads/${leadId}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat detail lead.");
        }
        return (await res.json()) as LeadDetailDto;
      })
      .then((detail) => {
        seenMessageIds.current = new Set(detail.messages.map((m) => m.id));
        setLead(detail);
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memuat detail lead.");
      });

    fetch(`/api/leads/${leadId}/scoring-history`)
      .then(async (res) => (res.ok ? ((await res.json()) as unknown) : []))
      .then((data) => {
        const events = Array.isArray(data) ? (data as ScoringEventDto[]) : [];
        seenScoringIds.current = new Set(events.map((e) => e.id));
        setScoringEvents(events);
      })
      .catch(() => undefined);
  }, [leadId]);

  useEffect(() => {
    const channel = subscribeToLeadChat(leadId, {
      onNewMessage: (message) => {
        if (seenMessageIds.current.has(message.id)) {
          return;
        }
        seenMessageIds.current.add(message.id);
        setLead((current) =>
          current === undefined
            ? current
            : { ...current, messages: [...current.messages, message] },
        );
      },
      onNewScoringEvent: (event) => {
        if (seenScoringIds.current.has(event.id)) {
          return;
        }
        seenScoringIds.current.add(event.id);
        setScoringEvents((current) => [...current, event]);
        setLead((current) =>
          current === undefined ? current : { ...current, score: event.scoreAfter },
        );
      },
    });
    return () => {
      void channel.unsubscribe();
    };
  }, [leadId]);

  async function handleIntervene(): Promise<void> {
    if (lead === undefined || interveneText.trim().length === 0) {
      return;
    }
    setSendStatus("sending");
    setSendError(undefined);
    try {
      const response = await fetch(`/api/leads/${leadId}/intervene`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: interveneText.trim() }),
      });
      if (!response.ok) {
        setSendStatus("error");
        setSendError("Gagal mengirim pesan. Coba lagi.");
        return;
      }
      const sent = (await response.json()) as MessageDto;
      if (!seenMessageIds.current.has(sent.id)) {
        seenMessageIds.current.add(sent.id);
        setLead((current) =>
          current === undefined ? current : { ...current, messages: [...current.messages, sent] },
        );
      }
      setInterveneText("");
      setSendStatus("idle");
    } catch {
      setSendStatus("error");
      setSendError("Gagal mengirim pesan. Coba lagi.");
    }
  }

  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }
  if (lead === undefined) {
    return <LoadingSpinner />;
  }

  const timeline = buildTimeline(lead.messages, scoringEvents);
  const crmBaseUrl = process.env.NEXT_PUBLIC_CRM_BASE_URL;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        {lead.leadName ?? lead.leadPhone}
        <span className={styles.headerMeta}>
          {lead.branchId} · {lead.temperature === "HOT" ? "🔥 HOT" : lead.temperature}
        </span>
      </div>

      <div className={styles.split}>
        <div className={styles.chatCard}>
          <div className={styles.chatHeader}>
            <span className={styles.chatHeaderTitle}>
              💬 Percakapan Jessy × {lead.leadName ?? "Lead"}
            </span>
            <span className={styles.liveDot} data-testid="live-indicator">
              🔴 Live
            </span>
          </div>

          <div className={styles.timeline} data-testid="chat-timeline">
            {timeline.length === 0 ? (
              <p data-testid="chat-empty">Belum ada percakapan.</p>
            ) : (
              timeline.map((item) =>
                item.kind === "scoring" ? (
                  <div key={`scoring-${item.event.id}`} className={styles.systemEvent}>
                    {item.event.reason} {item.event.delta >= 0 ? "+" : ""}
                    {item.event.delta} pts → {item.event.scoreAfter}
                  </div>
                ) : (
                  <div key={item.message.id} className={bubbleClass(item.message)}>
                    <div>
                      <div className={styles.senderLabel}>{senderLabel(item.message)}</div>
                      <div className={styles.bubble}>
                        {item.message.body ?? `[${item.message.messageType}]`}
                      </div>
                      <div className={styles.timestamp}>
                        {formatTime(item.message.sentAt ?? item.message.createdAt)}
                      </div>
                    </div>
                  </div>
                ),
              )
            )}
          </div>

          <form
            className={styles.interveneForm}
            onSubmit={(event) => {
              event.preventDefault();
              void handleIntervene();
            }}
          >
            <label htmlFor="intervene-text" className={styles.interveneLabel}>
              💬 Tulis sebagai Jessy (intervensi):
            </label>
            <div className={styles.interveneRow}>
              <input
                id="intervene-text"
                type="text"
                value={interveneText}
                onChange={(event) => setInterveneText(event.target.value)}
                placeholder="Ketik pesan..."
                className={styles.interveneInput}
              />
              <button
                type="submit"
                disabled={sendStatus === "sending" || interveneText.trim().length === 0}
                className={styles.sendButton}
              >
                {sendStatus === "sending" ? "Mengirim..." : "Kirim"}
              </button>
            </div>
            <span className={styles.warnLine}>
              ⚠ Pesan ini akan dikirim via WhatsApp sebagai Jessy
            </span>
            {sendStatus === "error" && sendError !== undefined ? (
              <span data-testid="intervene-error" className={styles.errorLine}>
                {sendError}
              </span>
            ) : null}
          </form>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className={styles.card}>
            <p className={styles.cardTitle}>📋 Info Lead</p>
            <dl className={styles.infoList}>
              <div className={styles.infoRow}>
                <dt className={styles.infoLabel}>WA</dt>
                <dd>
                  <a href={waLink(lead.leadPhone)} target="_blank" rel="noreferrer">
                    {lead.leadPhone}
                  </a>
                </dd>
              </div>
              <div className={styles.infoRow}>
                <dt className={styles.infoLabel}>Cabang</dt>
                <dd>{lead.branchId}</dd>
              </div>
              {lead.campaignId !== undefined ? (
                <div className={styles.infoRow}>
                  <dt className={styles.infoLabel}>Campaign</dt>
                  <dd>#{lead.campaignId}</dd>
                </div>
              ) : null}
              <div className={styles.infoRow}>
                <dt className={styles.infoLabel}>Masuk</dt>
                <dd>{formatTime(lead.createdAt)}</dd>
              </div>
            </dl>
          </div>

          <div className={styles.card}>
            <p className={styles.cardTitle}>📊 Score</p>
            <div className={styles.scoreBarTrack}>
              <div
                className={styles.scoreBarFill}
                style={{ width: `${Math.min(100, Math.max(0, lead.score))}%` }}
              />
            </div>
            <div className={styles.scoreLine}>
              <span>{lead.score}/100</span>
              <span>{lead.temperature === "HOT" ? "🔥 HOT" : lead.temperature}</span>
            </div>
            {scoringEvents.length > 0 ? (
              <div className={styles.scoreTimeline} data-testid="scoring-timeline">
                {scoringEvents.map((event) => (
                  <div key={event.id}>
                    {formatTime(event.createdAt)} · {event.scoreAfter} ← {event.reason} (
                    {event.delta >= 0 ? "+" : ""}
                    {event.delta})
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className={styles.card}>
            <p className={styles.cardTitle}>👤 Sales Assigned</p>
            {lead.assignedSalesId !== undefined ? (
              <p>
                {lead.assignedSalesId}
                {lead.assignedAt !== undefined ? ` · Diklaim ${formatTime(lead.assignedAt)}` : ""}
              </p>
            ) : (
              <p className={styles.infoLabel}>Belum ada sales yang mengklaim lead ini.</p>
            )}
          </div>

          <div className={styles.card}>
            <p className={styles.cardTitle}>✅ Actions</p>
            <div className={styles.actions}>
              <a
                href={waLink(lead.leadPhone)}
                target="_blank"
                rel="noreferrer"
                className={styles.actionPrimary}
              >
                📞 Hubungi via WA
              </a>
              {crmBaseUrl !== undefined && crmBaseUrl.length > 0 ? (
                <a
                  href={`${crmBaseUrl}/closing/new?leadId=${lead.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.actionButton}
                >
                  ✏ Input Closing
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  title="Butuh NEXT_PUBLIC_CRM_BASE_URL — input closing dilakukan di aplikasi CRM sales"
                  className={styles.actionButton}
                >
                  ✏ Input Closing (buka di CRM)
                </button>
              )}
              <button type="button" disabled title="Belum tersedia" className={styles.actionButton}>
                🔄 Re-assign Sales
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
