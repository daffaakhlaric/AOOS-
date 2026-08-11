import type { MetaAction } from "../types/MetaApiTypes.js";

/** action_type values Meta reports inside `insights.actions[]` that AAOS understands. */
const D3_ACTION_TYPE = "onsite_conversion.messaging_conversation_started_7d";
const CONVERSATIONS_ACTION_TYPE = "onsite_conversion.total_messaging_connection";
const LEAD_FORM_ACTION_TYPE = "onsite_conversion.lead";

export interface ActionBreakdown {
  /** D1 — `messaging_conversation_started` (noise, not a lead). */
  readonly conversations: number;
  /** D3 — PRIMARY METRIC, IS a lead. */
  readonly d3: number;
  /** `onsite_conversion.lead` — IS a lead. */
  readonly leadForm: number;
}

/**
 * Parses the Meta `actions[]` breakdown array into AAOS's D1/D3/lead-form counts, per the spec's
 * exact mapping:
 *
 *   "onsite_conversion.messaging_conversation_started_7d" → d3 (proxy)
 *   "onsite_conversion.total_messaging_connection"         → d1 (conversations)
 *
 * D2 and D5 are **not** computed here — Meta does not currently expose a native action_type for
 * "exactly 2 messages exchanged" or "exactly 5 messages exchanged" without a custom conversion or
 * Conversions API (CAPI) event configured on the ad account. AAOS defaults them to `0` at the
 * `MetricsMapper` call site (not here — this calculator only reports what actions[] *can*
 * express). This is a real, current Meta Marketing API limitation, not a bug: once CAPI is
 * active for a client, a future `D3Calculator` revision can add `d2`/`d5` extraction here without
 * changing this function's signature for `conversations`/`d3`/`leadForm`.
 *
 * Malformed entries — a non-array `actions`, an entry missing `action_type`/`value`, or a `value`
 * that doesn't parse to a finite number — are skipped individually rather than failing the whole
 * calculation (Meta's own API is known to occasionally include partial/placeholder action rows).
 *
 * `messagingConversationStarted` is the separate top-level insight field of the same name Meta
 * reports alongside `actions[]`; it is used only as a **fallback** for `conversations` when no
 * `onsite_conversion.total_messaging_connection` action row is present, since it is understood to
 * report the same underlying count as that action_type.
 */
export function calculateActionBreakdown(
  actions: ReadonlyArray<MetaAction> | undefined,
  messagingConversationStarted: string | undefined,
): ActionBreakdown {
  let d3 = 0;
  let conversations = 0;
  let leadForm = 0;
  let foundConversationsInActions = false;

  if (Array.isArray(actions)) {
    for (const action of actions) {
      if (
        action === null ||
        typeof action !== "object" ||
        typeof action.action_type !== "string" ||
        typeof action.value !== "string"
      ) {
        continue;
      }
      const parsed = Number(action.value);
      if (!Number.isFinite(parsed)) {
        continue;
      }
      switch (action.action_type) {
        case D3_ACTION_TYPE:
          d3 += parsed;
          break;
        case CONVERSATIONS_ACTION_TYPE:
          conversations += parsed;
          foundConversationsInActions = true;
          break;
        case LEAD_FORM_ACTION_TYPE:
          leadForm += parsed;
          break;
        default:
          break;
      }
    }
  }

  if (!foundConversationsInActions && typeof messagingConversationStarted === "string") {
    const fallback = Number(messagingConversationStarted);
    if (Number.isFinite(fallback)) {
      conversations = fallback;
    }
  }

  return { conversations, d3, leadForm };
}
