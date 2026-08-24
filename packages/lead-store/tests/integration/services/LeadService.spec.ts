import { AssignmentMode, BranchId, SalesHumanId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { LeadService } from "../../../src/application/services/LeadService.js";
import { CreateLead } from "../../../src/application/use-cases/CreateLead.js";
import { GetHotLeads } from "../../../src/application/use-cases/GetHotLeads.js";
import { GetLead } from "../../../src/application/use-cases/GetLead.js";
import { GetLeadsByBranch } from "../../../src/application/use-cases/GetLeadsByBranch.js";
import { GetLeadsBySales } from "../../../src/application/use-cases/GetLeadsBySales.js";
import { RecordAssignment } from "../../../src/application/use-cases/RecordAssignment.js";
import { RecordScoreEvent } from "../../../src/application/use-cases/RecordScoreEvent.js";
import { UpdateLeadStatus } from "../../../src/application/use-cases/UpdateLeadStatus.js";
import { LeadStoreEvents } from "../../../src/domain/events/LeadStoreEvents.js";
import { LeadSource } from "../../../src/domain/value-objects/LeadSource.js";
import { LeadStatus } from "../../../src/domain/value-objects/LeadStatus.js";
import { ScoreReason } from "../../../src/domain/value-objects/ScoreReason.js";
import { AssignmentRepository } from "../../../src/infrastructure/supabase/AssignmentRepository.js";
import { ConversationRepository } from "../../../src/infrastructure/supabase/ConversationRepository.js";
import { LeadRepository } from "../../../src/infrastructure/supabase/LeadRepository.js";
import { ScoringRepository } from "../../../src/infrastructure/supabase/ScoringRepository.js";
import { makeLeadRow } from "../../fixtures/leadStoreFixtures.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { unwrap } from "../../helpers/result.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

function setup() {
  const client = createFakeSupabaseClient();
  const leadRepository = new LeadRepository(client);
  const conversationRepository = new ConversationRepository(client);
  const scoringRepository = new ScoringRepository(client);
  const assignmentRepository = new AssignmentRepository(client);
  const events = new LeadStoreEvents(createFakePublisher());

  const service = new LeadService(
    new CreateLead(leadRepository, conversationRepository, events),
    new UpdateLeadStatus(leadRepository, events),
    new GetLead(leadRepository),
    new GetLeadsByBranch(leadRepository),
    new GetHotLeads(leadRepository),
    new GetLeadsBySales(leadRepository),
    new RecordScoreEvent(leadRepository, scoringRepository, events),
    new RecordAssignment(leadRepository, assignmentRepository, events),
  );
  return { client, service };
}

describe("LeadService facade", () => {
  it("create() delegates to CreateLead", async () => {
    const { service } = setup();
    const lead = unwrap(
      await service.create({
        leadSource: LeadSource.CTWA,
        leadPhone: "+6281200000099",
        branchId: BranchId.BINTARO,
        wabaPhoneNumberId: "waba-1",
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(lead.status).toBe("NEW");
  });

  it("updateStatus() delegates to UpdateLeadStatus", async () => {
    const { service, client } = setup();
    const row = makeLeadRow({ status: "NEW" });
    client.seed("leads", [row]);
    const lead = unwrap(
      await service.updateStatus({
        leadId: row.id,
        toStatus: LeadStatus.WARM,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(lead.status).toBe("WARM");
  });

  it("byId() delegates to GetLead", async () => {
    const { service, client } = setup();
    const row = makeLeadRow();
    client.seed("leads", [row]);
    const lead = unwrap(await service.byId(row.id));
    expect(lead.id.toString()).toBe(row.id);
  });

  it("byBranch() delegates to GetLeadsByBranch", async () => {
    const { service, client } = setup();
    client.seed("leads", [makeLeadRow({ branch_id: BranchId.BINTARO })]);
    const leads = unwrap(await service.byBranch(BranchId.BINTARO, "dss-motor"));
    expect(leads).toHaveLength(1);
  });

  it("hotByBranch() delegates to GetHotLeads", async () => {
    const { service, client } = setup();
    client.seed("leads", [makeLeadRow({ branch_id: BranchId.BINTARO, status: "HOT" })]);
    const leads = unwrap(await service.hotByBranch(BranchId.BINTARO, "dss-motor"));
    expect(leads).toHaveLength(1);
  });

  it("bySales() delegates to GetLeadsBySales", async () => {
    const { service, client } = setup();
    const salesHumanId = SalesHumanId.generate();
    client.seed("leads", [makeLeadRow({ assigned_sales_id: salesHumanId.toString() })]);
    const leads = unwrap(await service.bySales(salesHumanId, "dss-motor"));
    expect(leads).toHaveLength(1);
  });

  it("recordScore() delegates to RecordScoreEvent", async () => {
    const { service, client } = setup();
    const row = makeLeadRow({ score: 0 });
    client.seed("leads", [row]);
    const event = unwrap(
      await service.recordScore({
        leadId: row.id,
        scoreBefore: 0,
        scoreAfter: 25,
        delta: 25,
        reason: ScoreReason.BUDGET,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(event.scoreAfter).toBe(25);
  });

  it("assign() delegates to RecordAssignment", async () => {
    const { service, client } = setup();
    const row = makeLeadRow({ status: "HOT" });
    client.seed("leads", [row]);
    const assignment = unwrap(
      await service.assign({
        leadId: row.id,
        salesHumanId: SalesHumanId.generate().toString(),
        assignmentMode: AssignmentMode.SMART_ASSIGN,
        branchId: BranchId.BINTARO,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(assignment.status).toBe("ACTIVE");
  });
});
