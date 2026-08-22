import type { BranchId } from "@aos/branch-manager";
import type { IPublisher } from "@aos/event-bus";
import { createLogger, type Logger } from "@aos/logger";
import type { AdAccountId, AdAccountRegistry } from "@aos/meta-ads-connector";

import { ClosingService } from "../application/services/ClosingService.js";
import { ConversationService } from "../application/services/ConversationService.js";
import { LeadService } from "../application/services/LeadService.js";
import { RealtimeService } from "../application/services/RealtimeService.js";
import { CreateLead } from "../application/use-cases/CreateLead.js";
import { GetClosingStats } from "../application/use-cases/GetClosingStats.js";
import { GetConversation } from "../application/use-cases/GetConversation.js";
import { GetHotLeads } from "../application/use-cases/GetHotLeads.js";
import { GetLead } from "../application/use-cases/GetLead.js";
import { GetLeadsByBranch } from "../application/use-cases/GetLeadsByBranch.js";
import { GetLeadsBySales } from "../application/use-cases/GetLeadsBySales.js";
import { MarkLeadSyncedToMetaAudience } from "../application/use-cases/MarkLeadSyncedToMetaAudience.js";
import { RecordAssignment } from "../application/use-cases/RecordAssignment.js";
import { RecordClosing } from "../application/use-cases/RecordClosing.js";
import { RecordScoreEvent } from "../application/use-cases/RecordScoreEvent.js";
import { SaveMessage } from "../application/use-cases/SaveMessage.js";
import { SubscribeToHotLeads } from "../application/use-cases/SubscribeToHotLeads.js";
import { UpdateLeadStatus } from "../application/use-cases/UpdateLeadStatus.js";
import type { LeadStoreConfig } from "../config/LeadStoreConfig.js";
import type { ISpendProvider } from "../contracts/ISpendProvider.js";
import { LeadStoreEvents } from "../domain/events/LeadStoreEvents.js";
import { MetaAdsSpendAdapter } from "../infrastructure/adapters/MetaAdsSpendAdapter.js";
import { AssignmentRepository } from "../infrastructure/supabase/AssignmentRepository.js";
import { ClosingRepository } from "../infrastructure/supabase/ClosingRepository.js";
import { ConversationRepository } from "../infrastructure/supabase/ConversationRepository.js";
import { LeadRepository } from "../infrastructure/supabase/LeadRepository.js";
import { MessageRepository } from "../infrastructure/supabase/MessageRepository.js";
import { RealtimeSubscription } from "../infrastructure/supabase/RealtimeSubscription.js";
import { ScoringRepository } from "../infrastructure/supabase/ScoringRepository.js";
import { createSupabaseClient } from "../infrastructure/supabase/SupabaseClient.js";
import type { SupabaseClientLike } from "../infrastructure/supabase/SupabaseTypes.js";

/** A `ISpendProvider` that reports 0 spend for every campaign — the safe default when no `@aos/meta-ads-connector` registry is wired in (e.g. a deployment that doesn't run Tamara). `GetClosingStats` still returns correct `closingsByCampaign` counts either way; only `rphSpkByCampaign` amounts are 0. */
class ZeroSpendProvider implements ISpendProvider {
  async getSpendByCampaign(campaignIds: readonly string[]): Promise<ReadonlyMap<string, number>> {
    return Promise.resolve(new Map(campaignIds.map((id) => [id, 0])));
  }
}

export interface LeadStoreFactoryOptions {
  readonly config: LeadStoreConfig;
  /** Real `@aos/event-bus` `IPublisher` — always caller-supplied, the same composition-boundary discipline every prior AAOS package's factory establishes. */
  readonly publisher: IPublisher;
  readonly logger?: Logger;
  /** Injectable clock — defaults to the real wall clock only here. */
  readonly now?: () => Date;
  /** Injectable Supabase client (tests supply a mock satisfying `SupabaseClientLike`; production omits this and gets the real `@supabase/supabase-js` client). */
  readonly supabaseClient?: SupabaseClientLike;
  /** Optional real `@aos/meta-ads-connector` `AdAccountRegistry` + the ad account ids to read spend from — design resolution #3. Omit for a `ZeroSpendProvider` default. */
  readonly adAccountRegistry?: AdAccountRegistry;
  readonly adAccountIds?: readonly AdAccountId[];
}

export interface LeadStore {
  readonly createLead: CreateLead;
  readonly updateLeadStatus: UpdateLeadStatus;
  readonly getLead: GetLead;
  readonly getLeadsByBranch: GetLeadsByBranch;
  readonly getHotLeads: GetHotLeads;
  readonly getLeadsBySales: GetLeadsBySales;
  readonly saveMessage: SaveMessage;
  readonly getConversation: GetConversation;
  readonly recordScoreEvent: RecordScoreEvent;
  readonly recordAssignment: RecordAssignment;
  readonly recordClosing: RecordClosing;
  readonly subscribeToHotLeads: SubscribeToHotLeads;
  readonly getClosingStats: GetClosingStats;
  /** AAOS-ABTESTING-LOOKALIKE Part 2: marks a HOT lead's phone number as uploaded to Meta's Custom Audience. */
  readonly markLeadSyncedToMetaAudience: MarkLeadSyncedToMetaAudience;
  readonly leadService: LeadService;
  readonly conversationService: ConversationService;
  readonly realtimeService: RealtimeService;
  readonly closingService: ClosingService;
}

/** The composition root (Factory Pattern) — wires the Supabase client, every repository, the event publisher, and every use case/service. Mirrors `@aos/branch-manager`'s `BranchManagerFactory`. */
export class LeadStoreFactory {
  static create(options: LeadStoreFactoryOptions): LeadStore {
    const logger = options.logger ?? createLogger({ serviceName: "lead-store" });
    const now = options.now ?? (() => new Date());
    const client = options.supabaseClient ?? createSupabaseClient(options.config);

    const leadRepository = new LeadRepository(client);
    const conversationRepository = new ConversationRepository(client);
    const messageRepository = new MessageRepository(client);
    const scoringRepository = new ScoringRepository(client);
    const assignmentRepository = new AssignmentRepository(client);
    const closingRepository = new ClosingRepository(client);

    const events = new LeadStoreEvents(options.publisher);

    const spendProvider: ISpendProvider =
      options.adAccountRegistry !== undefined
        ? new MetaAdsSpendAdapter(options.adAccountRegistry, options.adAccountIds ?? [])
        : new ZeroSpendProvider();

    const createLead = new CreateLead(leadRepository, conversationRepository, events, now);
    const updateLeadStatus = new UpdateLeadStatus(leadRepository, events, now);
    const getLead = new GetLead(leadRepository);
    const getLeadsByBranch = new GetLeadsByBranch(leadRepository);
    const getHotLeads = new GetHotLeads(leadRepository);
    const getLeadsBySales = new GetLeadsBySales(leadRepository);
    const saveMessage = new SaveMessage(
      messageRepository,
      conversationRepository,
      leadRepository,
      events,
      now,
    );
    const getConversation = new GetConversation(conversationRepository);
    const recordScoreEvent = new RecordScoreEvent(leadRepository, scoringRepository, events, now);
    const recordAssignment = new RecordAssignment(
      leadRepository,
      assignmentRepository,
      events,
      now,
    );
    const recordClosing = new RecordClosing(leadRepository, closingRepository, events, now);
    const subscribeToHotLeads = new SubscribeToHotLeads(
      (branchId: BranchId) => new RealtimeSubscription(client, branchId),
    );
    const getClosingStats = new GetClosingStats(closingRepository, spendProvider);
    const markLeadSyncedToMetaAudience = new MarkLeadSyncedToMetaAudience(leadRepository, now);

    logger.info({ tenantId: options.config.tenantId }, "lead-store: factory composed");

    return {
      createLead,
      updateLeadStatus,
      getLead,
      getLeadsByBranch,
      getHotLeads,
      getLeadsBySales,
      saveMessage,
      getConversation,
      recordScoreEvent,
      recordAssignment,
      recordClosing,
      subscribeToHotLeads,
      getClosingStats,
      markLeadSyncedToMetaAudience,
      leadService: new LeadService(
        createLead,
        updateLeadStatus,
        getLead,
        getLeadsByBranch,
        getHotLeads,
        getLeadsBySales,
        recordScoreEvent,
        recordAssignment,
      ),
      conversationService: new ConversationService(saveMessage, getConversation),
      realtimeService: new RealtimeService(subscribeToHotLeads),
      closingService: new ClosingService(recordClosing, getClosingStats),
    };
  }
}
