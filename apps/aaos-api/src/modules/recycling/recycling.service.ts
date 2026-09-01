import { ALL_BRANCH_IDS, toBranch } from "@aos/branch-manager";
import { NotFoundError } from "@aos/errors";
import {
  ConversationNotFoundError,
  type ILeadRepository,
  type Lead,
  type LeadStore,
} from "@aos/lead-store";
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import {
  AAOS_API_CONFIG,
  LEAD_STORE,
  LEAD_STORE_LEAD_REPOSITORY,
  WHATSAPP_CONNECTOR_REGISTRY,
} from "../../di-tokens.js";
import type { WhatsAppConnectorRegistry } from "../whatsapp/infrastructure/whatsapp-connector-registry.js";

import {
  isInRecyclingPool,
  isReadyToSend,
  shouldArchiveAfterBroadcast,
} from "./domain/recycling-criteria.js";
import type { BroadcastAllResultDto, BroadcastResultDto } from "./dto/broadcast.dto.js";
import type { CreateTemplateBodyDto, UpdateTemplateBodyDto } from "./dto/template.dto.js";
import {
  BroadcastLogRepository,
  type BroadcastLogRow,
} from "./infrastructure/broadcast-log.repository.js";
import {
  BroadcastTemplateRepository,
  type BroadcastTemplateRow,
} from "./infrastructure/broadcast-template.repository.js";
import { RecyclingSettingsRepository } from "./infrastructure/recycling-settings.repository.js";

/** Real, honest substitutions only — {nama}/{cabang} are the only recycling-pool-derivable variables this app has real data for today. Any other `{xxx}` placeholder (e.g. {unit}/{dp}/{harga}/{judul_listing}/{nama_perusahaan}) is left UN-substituted rather than fabricated — no knowledge-base/listing-match wiring exists in `aaos-api` for those (out of scope here; a future pass can extend this map with real sources). */
function renderTemplate(content: string, lead: Lead): string {
  return content.replaceAll("{nama}", lead.leadName ?? "Kak").replaceAll("{cabang}", lead.branchId);
}

export interface RecyclingRunResult {
  readonly summary: string;
  readonly attempted: number;
  readonly sent: number;
  readonly failed: number;
}

/**
 * Lead Recycling & Broadcast (AAOS-LEAD-RECYCLING-BROADCAST). Single-tenant, exactly like every
 * other service in this app (coordinator note section 4) — every method operates on
 * `this.config.AAOS_TENANT_ID`, no per-tenant loop.
 */
@Injectable()
export class RecyclingService {
  private readonly logger = new Logger(RecyclingService.name);

  constructor(
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    @Inject(LEAD_STORE) private readonly leadStore: LeadStore,
    @Inject(LEAD_STORE_LEAD_REPOSITORY) private readonly leadRepository: ILeadRepository,
    @Inject(WHATSAPP_CONNECTOR_REGISTRY)
    private readonly whatsAppConnectorRegistry: WhatsAppConnectorRegistry,
    private readonly templateRepository: BroadcastTemplateRepository,
    private readonly logRepository: BroadcastLogRepository,
    private readonly settingsRepository: RecyclingSettingsRepository,
    // `@Optional()` — a bare `Function`-typed constructor param with a default value still gets a
    // real DI resolution attempt from Nest (recurring bug this session — see `GoLiveService`'s
    // own `now` param for the original fix). Without this, real bootstrap fails with "Nest can't
    // resolve dependencies of the RecyclingService (..., ?)".
    @Optional() private readonly now: () => Date = () => new Date(),
  ) {}

  // ---------------------------------------------------------------------------------------------
  // TAB 1: Recycling Pool — `GET /api/v1/recycling/pool`.
  // ---------------------------------------------------------------------------------------------

  /** Every lead in the recycling pool (`isInRecyclingPool`), fanned out across `ALL_BRANCH_IDS` — same pattern `SchedulerService.countHotLeads()` already establishes (coordinator note section 3, option b). */
  async getPool(): Promise<readonly Lead[]> {
    const at = this.now();
    const perBranch = await Promise.all(
      ALL_BRANCH_IDS.map((branchId) =>
        this.leadStore.getLeadsByBranch.execute(branchId, this.config.AAOS_TENANT_ID),
      ),
    );
    const leads = perBranch.flatMap((result) => {
      if (!result.ok) {
        this.logger.warn(
          `RecyclingService.getPool: a branch fetch failed: ${result.error.message}`,
        );
        return [];
      }
      return result.value;
    });
    return leads.filter((lead) => isInRecyclingPool(lead, at));
  }

  isReadyToSendNow(lead: Lead): boolean {
    return isReadyToSend(lead, this.now());
  }

  // ---------------------------------------------------------------------------------------------
  // TAB 2: Template Broadcast.
  // ---------------------------------------------------------------------------------------------

  async listTemplates(): Promise<readonly BroadcastTemplateRow[]> {
    return this.templateRepository.listByTenant(this.config.AAOS_TENANT_ID);
  }

  async createTemplate(body: CreateTemplateBodyDto): Promise<BroadcastTemplateRow> {
    return this.templateRepository.insert({
      tenant_id: this.config.AAOS_TENANT_ID,
      name: body.name,
      content: body.content,
      target_statuses: body.targetStatuses,
      cooldown_days: body.cooldownDays,
      status: body.status,
    });
  }

  async updateTemplate(id: string, body: UpdateTemplateBodyDto): Promise<BroadcastTemplateRow> {
    const existing = await this.templateRepository.findById(id);
    if (existing === undefined) {
      throw new NotFoundError(`No broadcast template found with id "${id}"`);
    }
    return this.templateRepository.update(id, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.content !== undefined ? { content: body.content } : {}),
      ...(body.targetStatuses !== undefined ? { target_statuses: body.targetStatuses } : {}),
      ...(body.cooldownDays !== undefined ? { cooldown_days: body.cooldownDays } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Auto Mode (coordinator note section 8).
  // ---------------------------------------------------------------------------------------------

  async getAutoMode(): Promise<boolean> {
    return this.settingsRepository.getAutoMode(this.config.AAOS_TENANT_ID);
  }

  async setAutoMode(autoMode: boolean): Promise<void> {
    await this.settingsRepository.setAutoMode(this.config.AAOS_TENANT_ID, autoMode);
  }

  // ---------------------------------------------------------------------------------------------
  // Sending — manual per-lead (`POST /broadcast/:leadId`) always works regardless of Auto Mode
  // (coordinator note section 8: only the CALENDAR-DRIVEN path is gated).
  // ---------------------------------------------------------------------------------------------

  /** `POST /api/v1/recycling/broadcast/:leadId` — manager picks the template explicitly. */
  async broadcastToLead(
    leadId: string,
    templateId: string,
    correlationId: string,
  ): Promise<BroadcastResultDto> {
    // PROPERTY-TENANT-ISOLATION Phase 1: GetLead.execute now requires a real tenantId (the
    // findById IDOR fix). This module is out of this phase's scope (recycling, not leads) and
    // has no per-request tenant-context mechanism of its own yet (same static
    // `this.config.AAOS_TENANT_ID` this class already reads for getAutoMode/setAutoMode above) —
    // kept as-is here purely to keep this out-of-scope module compiling; not a regression, since
    // this call site never had a real per-request tenantId to thread through in the first place.
    const leadResult = await this.leadStore.getLead.execute(leadId, this.config.AAOS_TENANT_ID);
    if (!leadResult.ok) {
      throw leadResult.error;
    }
    const template = await this.templateRepository.findById(templateId);
    if (template === undefined) {
      throw new NotFoundError(`No broadcast template found with id "${templateId}"`);
    }
    return this.sendOne(leadResult.value, template, correlationId);
  }

  /** `POST /api/v1/recycling/broadcast-all` — every lead currently ready to send, each with `selectBestTemplate`'s own pick. */
  async broadcastAll(correlationId: string): Promise<BroadcastAllResultDto> {
    const pool = await this.getPool();
    const at = this.now();
    const ready = pool.filter((lead) => isReadyToSend(lead, at));
    return this.sendMany(ready, correlationId);
  }

  /**
   * The real Kalender-driven handler (`SchedulerService`'s `RECYCLING_RUN` case, coordinator note
   * section 7) — honors Auto Mode (section 8): OFF means an honest no-op, never a silent send.
   */
  async runRecyclingRun(correlationId: string): Promise<RecyclingRunResult> {
    const autoMode = await this.getAutoMode();
    if (!autoMode) {
      return {
        summary: "Auto Mode OFF, tidak ada broadcast dikirim",
        attempted: 0,
        sent: 0,
        failed: 0,
      };
    }
    const pool = await this.getPool();
    const at = this.now();
    const ready = pool.filter((lead) => isReadyToSend(lead, at));
    const result = await this.sendMany(ready, correlationId);
    const summary =
      result.sent.length > 0
        ? `${String(result.sent.length)} broadcast terkirim${result.failed.length > 0 ? ` · ${String(result.failed.length)} gagal` : ""}`
        : "Tidak ada lead siap di-broadcast";
    return {
      summary,
      attempted: result.attempted,
      sent: result.sent.length,
      failed: result.failed.length,
    };
  }

  async getLogs(limit: number): Promise<readonly BroadcastLogRow[]> {
    return this.logRepository.listByTenant(this.config.AAOS_TENANT_ID, limit);
  }

  // ---------------------------------------------------------------------------------------------
  // Internals.
  // ---------------------------------------------------------------------------------------------

  private async sendMany(
    leads: readonly Lead[],
    correlationId: string,
  ): Promise<BroadcastAllResultDto> {
    const sent: BroadcastResultDto[] = [];
    const failed: Array<{ readonly leadId: string; readonly reason: string }> = [];
    for (const lead of leads) {
      const template = await this.selectBestTemplate(lead);
      if (template === undefined) {
        failed.push({ leadId: lead.id.toString(), reason: "Tidak ada template yang cocok" });
        continue;
      }
      try {
        sent.push(await this.sendOne(lead, template, correlationId));
      } catch (caught) {
        const reason = caught instanceof Error ? caught.message : String(caught);
        failed.push({ leadId: lead.id.toString(), reason });
      }
    }
    return { attempted: leads.length, sent, failed };
  }

  /** Spec's `selectBestTemplate`: active templates targeting this lead's status, excluding ones already sent to this lead, highest `reply_rate` first. */
  private async selectBestTemplate(lead: Lead): Promise<BroadcastTemplateRow | undefined> {
    const templates = await this.templateRepository.listByTenant(this.config.AAOS_TENANT_ID);
    const active = templates.filter(
      (t) => t.status === "ACTIVE" && t.target_statuses.includes(lead.status),
    );
    const usedLogs = await this.logRepository.listByLead(lead.id.toString());
    const usedTemplateIds = new Set(
      usedLogs.map((log) => log.template_id).filter((id) => id !== null),
    );
    const available = active.filter((t) => !usedTemplateIds.has(t.id));
    if (available.length === 0) {
      return undefined;
    }
    return [...available].sort((a, b) => b.reply_rate - a.reply_rate)[0];
  }

  /** Shared send path — reuses the REAL `sendTextMessage` use case (coordinator note section 5), never a second/parallel send path. */
  private async sendOne(
    lead: Lead,
    template: BroadcastTemplateRow,
    correlationId: string,
  ): Promise<BroadcastResultDto> {
    const message = renderTemplate(template.content, lead);
    const at = this.now();

    const connectorResult = await this.whatsAppConnectorRegistry.resolve(
      this.config.AAOS_TENANT_ID,
    );
    if (!connectorResult.ok) {
      throw connectorResult.error;
    }

    const sendResult = await connectorResult.value.sendTextMessage.execute({
      branch: toBranch(lead.branchId),
      to: lead.leadPhone.toString(),
      body: message,
      tenantId: this.config.AAOS_TENANT_ID,
      correlationId,
    });
    if (!sendResult.ok) {
      throw sendResult.error;
    }

    // Best-effort: a recycling-pool lead should already have a conversation (they messaged Clara
    // before becoming COLD/WARM), but a missing one is a real, non-fatal state — same discipline
    // `LeadsService.getLeadDetail` already applies to `ConversationNotFoundError`.
    const conversationResult = await this.leadStore.getConversation.execute(lead.id.toString());
    if (conversationResult.ok) {
      const saveResult = await this.leadStore.saveMessage.execute({
        conversationId: conversationResult.value.id.toString(),
        direction: "OUTGOING",
        body: message,
        tenantId: this.config.AAOS_TENANT_ID,
        correlationId,
        senderType: "CLARA",
      });
      if (!saveResult.ok) {
        this.logger.warn(
          `RecyclingService.sendOne: saveMessage failed for lead ${lead.id.toString()}: ${saveResult.error.message}`,
        );
      }
    } else if (!(conversationResult.error instanceof ConversationNotFoundError)) {
      this.logger.warn(
        `RecyclingService.sendOne: getConversation failed for lead ${lead.id.toString()}: ${conversationResult.error.message}`,
      );
    }

    const log = await this.logRepository.insert({
      tenant_id: this.config.AAOS_TENANT_ID,
      lead_id: lead.id.toString(),
      template_id: template.id,
      message_sent: message,
    });
    await this.templateRepository.incrementSentCount(template.id);

    const newCount = lead.broadcastCount + 1;
    let updated = lead.withBroadcastSent(template.id, at, at);
    if (shouldArchiveAfterBroadcast(newCount)) {
      updated = updated.withRecyclingArchived(true, at);
    }
    const persistResult = await this.leadRepository.update(updated);
    if (!persistResult.ok) {
      this.logger.warn(
        `RecyclingService.sendOne: persisting broadcast fields failed for lead ${lead.id.toString()}: ${persistResult.error.message}`,
      );
    }

    return {
      leadId: lead.id.toString(),
      templateId: template.id,
      broadcastLogId: log.id,
      sentAt: log.sent_at,
    };
  }
}
