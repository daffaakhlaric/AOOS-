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
  | "INVALID_RESPONSE"
  /**
   * AAOS Samantha Professional Optimizer, Part C — `LlmService.diagnoseAdCopy`'s real, honest
   * degrade when `primaryText`/`headline`/`description` are ALL `undefined` (Meta's real creative
   * for this ad doesn't carry usable ad-copy text in the one real shape this package covers — see
   * `@aos/meta-ads-connector`'s `Ad.primaryText` docstring). Checked BEFORE the gate/OpenAI call —
   * there is no real copy text to hand the LLM, so asking it to analyze would only invite it to
   * hallucinate an analysis of text it never received.
   */
  | "NO_COPY_TEXT"
  /**
   * Creative Stress Test, Second Boundary — `LlmService.simulateStressTestPersona`/
   * `evaluateStressTestCopy`'s real, honest degrade when the creative under test has NO real
   * `primaryText`/`headline`/`description` at all (not even a listing-detail proxy) — see
   * `hasRealCreativeText` in `dto/stress-test-evaluators.dto.ts`. Checked BEFORE the gate/OpenAI
   * call, same discipline as `NO_COPY_TEXT` above.
   */
  | "NO_CREATIVE_CONTENT";

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
  NO_COPY_TEXT:
    "Teks iklan tidak tersedia dari Meta untuk tipe creative ini, tidak bisa dianalisis",
  NO_CREATIVE_CONTENT: "Tidak ada teks/creative nyata untuk dievaluasi pada run ini",
};

/** Builds an `available: false` fallback response with the spec's Section 7 Indonesian copy for `reason`. */
export function unavailable(reason: LlmUnavailableReason): LlmUnavailableResponseDto {
  return { available: false, reason, message: REASON_MESSAGES[reason] };
}
