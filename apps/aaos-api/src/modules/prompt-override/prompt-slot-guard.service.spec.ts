import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../test-support/fake-supabase-client.js";

import { PromptOverrideRepository } from "./infrastructure/prompt-override.repository.js";
import { extractSlots, PromptSlotGuardService } from "./prompt-slot-guard.service.js";

function seedRow(
  client: ReturnType<typeof createFakeSupabaseClient>,
  overrides: Partial<Record<string, unknown>> = {},
): void {
  client.seed("agent_prompt_overrides", {
    id: "row-1",
    tenant_id: "dss-motor",
    agent: "CLARA",
    prompt_key: "clara_system_prompt",
    content:
      "Branch: {branch}\nScore: {score}\nStage: {stage}\nProfile: {lead_profile}\nUnits: {available_units}\nTask: {stage_instruction}",
    version: 1,
    is_active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    activated_at: "2026-01-01T00:00:00.000Z",
    deactivated_at: null,
    ...overrides,
  });
}

const FULL_CLARA_REWRITE =
  "Kamu Clara. Cabang: {branch}. Skor lead: {score}. Tahap: {stage}. Profil: {lead_profile}. Unit tersedia: {available_units}. Tugas: {stage_instruction}. Balas natural.";

const MISSING_UNITS_ONE_LINER =
  "Ajukan pertanyaan yang lebih mendalam untuk menggali kebutuhan pengguna, dorong mereka untuk membagikan detail lebih lanjut.";

describe("extractSlots", () => {
  it("extracts every distinct real {slot} placeholder as a bare name, deduplicated, in first-seen order", () => {
    expect(extractSlots("Halo {branch}, skor {score}, stage {stage}, lagi {score}")).toEqual([
      "branch",
      "score",
      "stage",
    ]);
  });

  it("returns an empty array when the content has no real slot placeholders at all", () => {
    expect(extractSlots(MISSING_UNITS_ONE_LINER)).toEqual([]);
  });

  it("does not match a bare '{' or '}' with no real slot-shaped content between them", () => {
    expect(extractSlots("harga mulai dari {100 juta} rupiah")).toEqual([]);
  });

  it("does not match a slot-looking token with digits/uppercase (the real, deliberately narrow naming convention)", () => {
    expect(extractSlots("{Branch} {score1} {STAGE}")).toEqual([]);
  });
});

describe("PromptSlotGuardService", () => {
  describe("check — currently active override exists (real slots taken from its own content)", () => {
    it("BLOCKS a proposal missing one required slot ({available_units}) — the real production incident this fix prevents", async () => {
      const client = createFakeSupabaseClient();
      seedRow(client);
      const guard = new PromptSlotGuardService(new PromptOverrideRepository(client));

      const result = await guard.check(
        "dss-motor",
        "CLARA",
        "clara_system_prompt",
        FULL_CLARA_REWRITE.replace("Unit tersedia: {available_units}. ", ""),
      );

      expect(result.allowed).toBe(false);
      expect(result.missingSlots).toEqual(["available_units"]);
      expect(result.requiredSlots).toEqual([
        "branch",
        "score",
        "stage",
        "lead_profile",
        "available_units",
        "stage_instruction",
      ]);
    });

    it("BLOCKS the exact real production incident shape: a proposal missing SEVERAL required slots", async () => {
      const client = createFakeSupabaseClient();
      seedRow(client);
      const guard = new PromptSlotGuardService(new PromptOverrideRepository(client));

      const result = await guard.check(
        "dss-motor",
        "CLARA",
        "clara_system_prompt",
        MISSING_UNITS_ONE_LINER,
      );

      expect(result.allowed).toBe(false);
      expect(result.missingSlots).toEqual([
        "branch",
        "score",
        "stage",
        "lead_profile",
        "available_units",
        "stage_instruction",
      ]);
    });

    it("BLOCKS a proposal missing EVERY required slot (empty proposed content)", async () => {
      const client = createFakeSupabaseClient();
      seedRow(client);
      const guard = new PromptSlotGuardService(new PromptOverrideRepository(client));

      const result = await guard.check("dss-motor", "CLARA", "clara_system_prompt", "");

      expect(result.allowed).toBe(false);
      expect(result.missingSlots).toHaveLength(6);
    });

    it("ALLOWS a genuinely equivalent rewording that still contains every real slot placeholder verbatim (does NOT false-positive block a well-formed proposal)", async () => {
      const client = createFakeSupabaseClient();
      seedRow(client);
      const guard = new PromptSlotGuardService(new PromptOverrideRepository(client));

      const result = await guard.check(
        "dss-motor",
        "CLARA",
        "clara_system_prompt",
        FULL_CLARA_REWRITE,
      );

      expect(result.allowed).toBe(true);
      expect(result.missingSlots).toEqual([]);
    });

    it("ALLOWS a proposal that repeats a slot or adds new prose around every required slot", async () => {
      const client = createFakeSupabaseClient();
      seedRow(client);
      const guard = new PromptSlotGuardService(new PromptOverrideRepository(client));

      const result = await guard.check(
        "dss-motor",
        "CLARA",
        "clara_system_prompt",
        `${FULL_CLARA_REWRITE} (skor sekali lagi: {score})`,
      );

      expect(result.allowed).toBe(true);
    });
  });

  describe("check — no active override yet (falls back to the real base-template slot set)", () => {
    it("BLOCKS a proposal missing a base-template slot for clara_system_prompt", async () => {
      const client = createFakeSupabaseClient();
      const guard = new PromptSlotGuardService(new PromptOverrideRepository(client));

      const result = await guard.check(
        "dss-motor",
        "CLARA",
        "clara_system_prompt",
        MISSING_UNITS_ONE_LINER,
      );

      expect(result.allowed).toBe(false);
      expect(result.requiredSlots).toEqual([
        "branch",
        "score",
        "stage",
        "lead_profile",
        "available_units",
        "stage_instruction",
      ]);
    });

    it("BLOCKS a proposal missing a base-template slot for clara_property_system_prompt (PROPERTY, not yet corrupted but exposed to the same risk)", async () => {
      const client = createFakeSupabaseClient();
      const guard = new PromptSlotGuardService(new PromptOverrideRepository(client));

      const result = await guard.check(
        "agen-pintar-indonesia",
        "CLARA",
        "clara_property_system_prompt",
        "Skor: {score}. Tahap: {stage}. Tugas: {stage_instruction}.",
      );

      expect(result.allowed).toBe(false);
      expect(result.missingSlots).toEqual([
        "detected_intents",
        "matched_listings",
        "requested_property_type",
        "alternative_city",
        "sales_name",
      ]);
    });

    it("ALLOWS a well-formed clara_property_system_prompt proposal preserving every real base-template slot", async () => {
      const client = createFakeSupabaseClient();
      const guard = new PromptSlotGuardService(new PromptOverrideRepository(client));

      const result = await guard.check(
        "agen-pintar-indonesia",
        "CLARA",
        "clara_property_system_prompt",
        "Skor {score}, stage {stage}, sinyal {detected_intents}, listing {matched_listings}, " +
          "tipe {requested_property_type}, kota alt {alternative_city}, sales {sales_name}, " +
          "tugas {stage_instruction}",
      );

      expect(result.allowed).toBe(true);
    });

    it("NEVER blocks a prompt key with no known real slot contract (e.g. 'analyze' — verified directly: no {slot} substitution pass exists for it in LlmService)", async () => {
      const client = createFakeSupabaseClient();
      const guard = new PromptSlotGuardService(new PromptOverrideRepository(client));

      const result = await guard.check(
        "dss-motor",
        "SAMANTHA",
        "analyze",
        "any completely different content, no placeholders at all",
      );

      expect(result.allowed).toBe(true);
      expect(result.requiredSlots).toEqual([]);
    });
  });

  describe("check — real repository failure fails OPEN (never a new single point of failure)", () => {
    it("allows the proposal through and logs a warning when findActive throws", async () => {
      const client = createFakeSupabaseClient();
      client.forceErrorOnce("agent_prompt_overrides", "connection reset");
      const guard = new PromptSlotGuardService(new PromptOverrideRepository(client));

      const result = await guard.check(
        "dss-motor",
        "CLARA",
        "clara_system_prompt",
        MISSING_UNITS_ONE_LINER,
      );

      expect(result.allowed).toBe(true);
    });
  });
});
