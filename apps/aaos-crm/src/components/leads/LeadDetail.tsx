"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useSalesSession } from "@/lib/session";
import { subscribeToLeadChat } from "@/lib/realtime";
import type { LeadDetailDto, MessageDto, ScoringEventDto } from "@/types/crm.types";

import { ConversationHistory } from "./ConversationHistory";
import { LeadStatusBadge } from "./LeadStatusBadge";
import { QualificationBadges } from "./QualificationBadges";

export interface LeadDetailProps {
  readonly leadId: string;
}

/** WA Langsung link — `+6281234567890` -> `https://wa.me/6281234567890`. */
function waLink(phone: string): string {
  return `https://wa.me/${phone.replace(/^\+/, "")}`;
}

/**
 * Full lead info + REAL conversation history (spec "leads/[leadId]/page.tsx"). Coordinator note
 * #2: this page deliberately shows only real, honest data — `Lead`'s boolean qualification flags
 * (not fabricated "Budget: Rp 200 juta" text) and the real per-message conversation thread. There
 * is no "Ringkasan Jessy" prose-summary section — `@aos/lead-store` persists no such field
 * anywhere, so a placeholder-looking summary would not be backed by real data.
 *
 * AAOS-CHAT-ROOM-JESSY extends this with a reply input (`POST /api/leads/:id/message`, replacing
 * the previous `wa.me`-only reply affordance for a sales human actually assigned to this lead),
 * real `scoring_events` merged into the timeline, and a live Supabase Realtime subscription so a
 * new message/score change appears without a manual refresh.
 */
export function LeadDetail({ leadId }: LeadDetailProps): React.ReactElement {
  const [lead, setLead] = useState<LeadDetailDto | undefined>(undefined);
  const [scoringEvents, setScoringEvents] = useState<readonly ScoringEventDto[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [replyText, setReplyText] = useState("");
  const [sendStatus, setSendStatus] = useState<"idle" | "sending" | "error">("idle");
  const [sendError, setSendError] = useState<string | undefined>(undefined);
  const { session } = useSalesSession();
  const seenMessageIds = useRef(new Set<string>());

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
      .then((data) => setScoringEvents(Array.isArray(data) ? (data as ScoringEventDto[]) : []))
      .catch(() => undefined);
  }, [leadId]);

  useEffect(() => {
    const channel = subscribeToLeadChat(leadId, {
      onNewMessage: (message: MessageDto) => {
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
      onNewScoringEvent: (event: ScoringEventDto) => {
        setScoringEvents((current) =>
          current.some((existing) => existing.id === event.id) ? current : [...current, event],
        );
      },
    });
    return () => {
      void channel.unsubscribe();
    };
  }, [leadId]);

  async function handleSendReply(): Promise<void> {
    if (lead === undefined || replyText.trim().length === 0 || session === undefined) {
      return;
    }
    setSendStatus("sending");
    setSendError(undefined);
    try {
      const response = await fetch(`/api/leads/${leadId}/message`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          salesHumanId: session.salesHumanId,
          salesName: session.email?.split("@")[0] ?? "Sales",
          message: replyText.trim(),
        }),
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
      setReplyText("");
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

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-ink">{lead.leadName ?? lead.leadPhone}</h1>
        <LeadStatusBadge status={lead.status} />
      </div>

      <section className="rounded-card border border-hairline bg-surface-card p-4 shadow-card">
        <h2 className="text-sm font-semibold text-ink">📋 Info Lead</h2>
        <dl className="mt-2 flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-muted">WA</dt>
            <dd>
              {lead.leadPhone}{" "}
              <a
                href={waLink(lead.leadPhone)}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-brand-primary"
              >
                💬 WA Langsung
              </a>
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">Cabang</dt>
            <dd>{lead.branchId}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">Skor</dt>
            <dd>{lead.score}/100</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">Temperature</dt>
            <dd>{lead.temperature}</dd>
          </div>
        </dl>
        <div className="mt-3">
          <p className="text-xs font-semibold text-ink-muted">Kriteria Terpenuhi</p>
          <div className="mt-1">
            <QualificationBadges qualification={lead.qualification} />
          </div>
        </div>
      </section>

      <section className="rounded-card border border-hairline bg-surface-card p-4 shadow-card">
        <h2 className="text-sm font-semibold text-ink">📱 Riwayat Percakapan</h2>
        <div className="mt-2">
          <ConversationHistory messages={lead.messages} scoringEvents={scoringEvents} />
        </div>

        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSendReply();
          }}
        >
          <label htmlFor="reply-text" className="text-xs font-semibold text-ink-muted">
            Balas ke customer
          </label>
          <div className="flex gap-2">
            <input
              id="reply-text"
              type="text"
              value={replyText}
              onChange={(event) => setReplyText(event.target.value)}
              placeholder="Ketik pesan..."
              disabled={session === undefined}
              className="flex-1 rounded-button border border-hairline px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={
                sendStatus === "sending" || replyText.trim().length === 0 || session === undefined
              }
              className="rounded-button bg-brand-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {sendStatus === "sending" ? "Mengirim..." : "Kirim"}
            </button>
          </div>
          {sendStatus === "error" && sendError !== undefined ? (
            <span
              data-testid="send-message-error"
              className="text-xs font-medium text-brand-danger"
            >
              {sendError}
            </span>
          ) : null}
        </form>
      </section>

      <div className="flex gap-2">
        <a
          href={waLink(lead.leadPhone)}
          target="_blank"
          rel="noreferrer"
          className="flex-1 rounded-button bg-brand-primary px-4 py-2 text-center text-sm font-semibold text-white"
        >
          📞 Hubungi Sekarang
        </a>
        <Link
          href={`/closing/new?leadId=${lead.id}`}
          className="flex-1 rounded-button border border-brand-primary px-4 py-2 text-center text-sm font-semibold text-brand-primary"
        >
          ✅ Input Closing
        </Link>
      </div>
    </div>
  );
}
