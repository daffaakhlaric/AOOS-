import { AssignmentMode, BranchId, SalesHumanId } from "@aos/branch-manager";

import type { ClosingRow } from "../../src/infrastructure/mappers/ClosingMapper.js";
import type { ConversationRow } from "../../src/infrastructure/mappers/ConversationMapper.js";
import type { LeadRow } from "../../src/infrastructure/mappers/LeadMapper.js";
import type { MessageRow } from "../../src/infrastructure/mappers/MessageMapper.js";
import type { AssignmentRow } from "../../src/infrastructure/supabase/AssignmentRepository.js";
import type { ScoringEventRow } from "../../src/infrastructure/supabase/ScoringRepository.js";

export const FIXED_NOW = new Date("2026-01-15T09:00:00.000Z");

export function fixedClock(at: Date = FIXED_NOW): () => Date {
  return () => at;
}

let idCounter = 0;

/** Deterministic, per-test-run-unique UUID-shaped ids (not real UUIDs — good enough for fixtures/mock table keys). */
export function nextId(prefix = "id"): string {
  idCounter += 1;
  return `${prefix}-${String(idCounter).padStart(6, "0")}`;
}

export function makeLeadRow(overrides: Partial<LeadRow> = {}): LeadRow {
  return {
    id: nextId("lead"),
    tenant_id: "dss-motor",
    lead_source: "CTWA",
    campaign_id: "#C047",
    ad_id: "#A001",
    ad_account_id: "act_1",
    lead_phone: "+6281200000099",
    lead_name: "Budi",
    branch_id: BranchId.BINTARO,
    waba_phone_number_id: "waba-bintaro-001",
    status: "NEW",
    score: 0,
    temperature: "COLD",
    qual_budget: false,
    qual_unit: false,
    qual_area: false,
    qual_payment: false,
    qual_timeline: false,
    qual_name: false,
    assigned_sales_id: null,
    assigned_at: null,
    assignment_mode: null,
    first_message_at: null,
    last_message_at: null,
    became_hot_at: null,
    broadcast_count: 0,
    last_broadcast_at: null,
    last_broadcast_template_id: null,
    recycling_archived: false,
    synced_to_meta_audience: false,
    synced_at: null,
    created_at: FIXED_NOW.toISOString(),
    updated_at: FIXED_NOW.toISOString(),
    ...overrides,
  };
}

export function makeConversationRow(overrides: Partial<ConversationRow> = {}): ConversationRow {
  return {
    id: nextId("conv"),
    lead_id: nextId("lead"),
    branch_id: BranchId.BINTARO,
    waba_phone_number_id: "waba-bintaro-001",
    message_count: 0,
    incoming_count: 0,
    outgoing_count: 0,
    d1_count: 0,
    d2_count: 0,
    d3_count: 0,
    d5_count: 0,
    current_stage: "GREETING",
    last_intent: null,
    started_at: FIXED_NOW.toISOString(),
    last_message_at: FIXED_NOW.toISOString(),
    status: "ACTIVE",
    ...overrides,
  };
}

export function makeMessageRow(overrides: Partial<MessageRow> = {}): MessageRow {
  return {
    id: nextId("msg"),
    conversation_id: nextId("conv"),
    lead_id: nextId("lead"),
    direction: "INCOMING",
    message_type: "TEXT",
    body: "Halo",
    wamid: "wamid.1",
    template_name: null,
    delivery_status: null,
    sent_at: null,
    delivered_at: null,
    read_at: null,
    created_at: FIXED_NOW.toISOString(),
    sender_type: null,
    sender_name: null,
    ...overrides,
  };
}

export function makeClosingRow(overrides: Partial<ClosingRow> = {}): ClosingRow {
  return {
    id: nextId("closing"),
    lead_id: nextId("lead"),
    sales_human_id: SalesHumanId.generate().toString(),
    branch_id: BranchId.BINTARO,
    closing_type: "SPK",
    unit_id: "unit-1",
    unit_model: "Xpander Cross AT 2019",
    unit_price: 280_000_000,
    campaign_id: "#C047",
    ad_id: "#A001",
    commission_idr: 2_000_000,
    commission_pct: 1.5,
    notes: null,
    test_drive_at: null,
    spk_at: FIXED_NOW.toISOString(),
    created_at: FIXED_NOW.toISOString(),
    ...overrides,
  };
}

export function makeAssignmentRow(overrides: Partial<AssignmentRow> = {}): AssignmentRow {
  return {
    id: nextId("assignment"),
    lead_id: nextId("lead"),
    branch_id: BranchId.BINTARO,
    sales_human_id: SalesHumanId.generate().toString(),
    assignment_mode: AssignmentMode.SMART_ASSIGN,
    assigned_at: FIXED_NOW.toISOString(),
    released_at: null,
    status: "ACTIVE",
    ...overrides,
  };
}

export function makeScoringEventRow(overrides: Partial<ScoringEventRow> = {}): ScoringEventRow {
  return {
    id: nextId("score"),
    lead_id: nextId("lead"),
    score_before: 0,
    score_after: 25,
    delta: 25,
    reason: "BUDGET",
    triggered_by: null,
    created_at: FIXED_NOW.toISOString(),
    ...overrides,
  };
}
