/**
 * The distinguishable "AI unavailable" shape every `llm` endpoint can return instead of its
 * normal payload — spec Section 7's fallback requirement, made explicit/typed rather than a raw
 * HTTP error, so callers (the dashboard) can branch on `available` and fall back to rule-based
 * analysis without needing to inspect an HTTP status code or catch an exception.
 */
export type LlmUnavailableReason =
  /** `AaosApiConfig.OPENAI_API_KEY` is empty/unset. */
  | "NO_API_KEY"
  /** The local `TokenBucketRateLimiter` budget (spec: "Max 10 LLM calls per minute") is exhausted. */
  | "RATE_LIMITED"
  /** The OpenAI call itself failed — network failure, timeout, or non-2xx response. */
  | "PROVIDER_ERROR"
  /** OpenAI responded successfully, but its body wasn't valid JSON matching the expected schema (coordinator note #5 — defensive JSON parsing). */
  | "INVALID_RESPONSE";

export interface LlmUnavailableResponseDto {
  readonly available: false;
  readonly reason: LlmUnavailableReason;
  readonly message: string;
}

const REASON_MESSAGES: Record<LlmUnavailableReason, string> = {
  NO_API_KEY: "Aktifkan AI Analysis dengan menambahkan OPENAI_API_KEY di settings",
  RATE_LIMITED: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
  PROVIDER_ERROR: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
  INVALID_RESPONSE: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
};

/** Builds an `available: false` fallback response with the spec's Section 7 Indonesian copy for `reason`. */
export function unavailable(reason: LlmUnavailableReason): LlmUnavailableResponseDto {
  return { available: false, reason, message: REASON_MESSAGES[reason] };
}
