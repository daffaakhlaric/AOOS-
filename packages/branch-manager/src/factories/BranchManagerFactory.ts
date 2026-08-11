import type { IPublisher } from "@aos/event-bus";
import { createLogger, type Logger } from "@aos/logger";
import { getTracer } from "@aos/telemetry";

import { AvailabilityService } from "../application/services/AvailabilityService.js";
import { LeadAssignmentService } from "../application/services/LeadAssignmentService.js";
import { QueueService } from "../application/services/QueueService.js";
import type { Tracer } from "../application/tracer.js";
import { AddSalesHuman } from "../application/use-cases/AddSalesHuman.js";
import { AssignLead } from "../application/use-cases/AssignLead.js";
import { DetectBranch } from "../application/use-cases/DetectBranch.js";
import { FlushQueue } from "../application/use-cases/FlushQueue.js";
import { GetAssignmentQueue } from "../application/use-cases/GetAssignmentQueue.js";
import { GetAvailableSales } from "../application/use-cases/GetAvailableSales.js";
import { GetBranchStatus } from "../application/use-cases/GetBranchStatus.js";
import { RemoveSalesHuman } from "../application/use-cases/RemoveSalesHuman.js";
import { UpdateSalesStatus } from "../application/use-cases/UpdateSalesStatus.js";
import { BranchConfigBuilder } from "../builders/BranchConfigBuilder.js";
import type { BranchManagerConfig } from "../config/BranchManagerConfig.js";
import type { IAssignmentStrategy } from "../contracts/IAssignmentStrategy.js";
import type { BranchConfig } from "../domain/entities/BranchConfig.js";
import { BranchManagerEvents } from "../domain/events/BranchManagerEvents.js";
import { AssignmentMode } from "../domain/value-objects/AssignmentMode.js";
import { BranchId } from "../domain/value-objects/BranchId.js";
import { ManualAssignStrategy } from "../intelligence/ManualAssignStrategy.js";
import { RoundRobinStrategy } from "../intelligence/RoundRobinStrategy.js";
import { SmartAssignStrategy } from "../intelligence/SmartAssignStrategy.js";
import { BranchRegistry } from "../registry/BranchRegistry.js";
import { SalesTeamRegistry } from "../registry/SalesTeamRegistry.js";

interface DssMotorBranchSeed {
  readonly id: BranchId;
  readonly name: string;
  readonly displayName: string;
  readonly phoneNumberId: string;
  readonly phoneNumber: string;
  readonly assignmentMode: AssignmentMode;
  readonly maxLeadsPerSalesPerDay: number;
}

/**
 * DSS Motor's 4 real branches (spec "DSS Motor Branch Config (Hardcoded for MVP)"), with
 * per-branch `assignmentMode`/`maxLeadsPerSalesPerDay` matching the spec's literal example exactly
 * (Bintaro/Cinere/Bandung → `SMART_ASSIGN`, "Pondok Bambu" → `ROUND_ROBIN`; Bandung's smaller team
 * → `maxLeadsPerSalesPerDay: 8`). Phone-number-id values are threaded through `BranchManagerConfig`
 * (never a direct `process.env` read here) — see the `BranchId.PONDOK_BAMBU` → `BranchId.UMUM`
 * resolution in `domain/value-objects/BranchId.ts` for why the third seed's `id` is `UMUM`.
 */
function dssMotorBranchSeeds(config: BranchManagerConfig): readonly DssMotorBranchSeed[] {
  return [
    {
      id: BranchId.BINTARO,
      name: "Mobix Bintaro",
      displayName: "Cabang Bintaro",
      phoneNumberId: config.phoneNumberIdBintaro,
      phoneNumber: config.phoneNumberBintaro,
      assignmentMode: AssignmentMode.SMART_ASSIGN,
      maxLeadsPerSalesPerDay: 10,
    },
    {
      id: BranchId.CINERE,
      name: "Mobix Cinere",
      displayName: "Cabang Cinere",
      phoneNumberId: config.phoneNumberIdCinere,
      phoneNumber: config.phoneNumberCinere,
      assignmentMode: AssignmentMode.SMART_ASSIGN,
      maxLeadsPerSalesPerDay: 10,
    },
    {
      id: BranchId.UMUM,
      name: "Mobix Pondok Bambu",
      displayName: "Cabang Pondok Bambu",
      phoneNumberId: config.phoneNumberIdPondokBambu,
      phoneNumber: config.phoneNumberPondokBambu,
      assignmentMode: AssignmentMode.ROUND_ROBIN,
      maxLeadsPerSalesPerDay: 10,
    },
    {
      id: BranchId.BANDUNG,
      name: "Mobix Bandung",
      displayName: "Cabang Bandung",
      phoneNumberId: config.phoneNumberIdBandung,
      phoneNumber: config.phoneNumberBandung,
      assignmentMode: AssignmentMode.SMART_ASSIGN,
      maxLeadsPerSalesPerDay: 8,
    },
  ];
}

function buildDssMotorBranchConfigs(config: BranchManagerConfig): BranchConfig[] {
  return dssMotorBranchSeeds(config).map((seed) => {
    const result = new BranchConfigBuilder()
      .withId(seed.id)
      .withName(seed.name)
      .withDisplayName(seed.displayName)
      .withWabaPhoneNumberId(seed.phoneNumberId)
      .withWabaPhoneNumber(seed.phoneNumber)
      .withAssignmentMode(seed.assignmentMode)
      .withMaxLeadsPerSalesPerDay(seed.maxLeadsPerSalesPerDay)
      .build();
    /* v8 ignore start -- every field above is either a hardcoded-valid literal or sourced from a
       `BranchManagerConfig` already validated by `parseBranchManagerConfig` (non-empty phone
       number id/number strings, `maxLeadsPerSalesPerDay` bounded elsewhere to [1, 50]), so this
       can never fail in practice. */
    if (!result.ok) {
      throw new Error(
        `unreachable: DSS Motor branch seed "${seed.id}" failed to build: ${result.error.message}`,
      );
    }
    /* v8 ignore stop */
    return result.value;
  });
}

export interface BranchManagerFactoryOptions {
  readonly config: BranchManagerConfig;
  /** Real `@aos/event-bus` `IPublisher` — always caller-supplied, the same composition-boundary discipline every prior AAOS package's factory establishes. */
  readonly publisher: IPublisher;
  readonly logger?: Logger;
  readonly tracer?: Tracer;
  /** Injectable clock — defaults to the real wall clock only here. */
  readonly now?: () => Date;
}

export interface BranchManager {
  readonly assignLead: AssignLead;
  readonly detectBranch: DetectBranch;
  readonly updateSalesStatus: UpdateSalesStatus;
  readonly addSalesHuman: AddSalesHuman;
  readonly removeSalesHuman: RemoveSalesHuman;
  readonly getBranchStatus: GetBranchStatus;
  readonly getAssignmentQueue: GetAssignmentQueue;
  readonly flushQueue: FlushQueue;
  readonly getAvailableSales: GetAvailableSales;
  readonly leadAssignmentService: LeadAssignmentService;
  readonly availabilityService: AvailabilityService;
  readonly queueService: QueueService;
  readonly branchRegistry: BranchRegistry;
  readonly salesTeamRegistry: SalesTeamRegistry;
}

/**
 * The composition root (Factory Pattern) — wires every real `@aos/*` integration, seeds the 4 DSS
 * Motor branches, registers the 3 assignment strategies, and breaks the
 * `QueueService` <-> `LeadAssignmentService` cycle via setter injection
 * (`QueueService.attachAssignmentService`, see that class's docstring).
 */
export class BranchManagerFactory {
  static create(options: BranchManagerFactoryOptions): BranchManager {
    const logger = options.logger ?? createLogger({ serviceName: "branch-manager" });
    const tracer: Tracer = options.tracer ?? getTracer("branch-manager");
    const now = options.now ?? (() => new Date());

    const branchRegistry = new BranchRegistry(buildDssMotorBranchConfigs(options.config));
    const salesTeamRegistry = new SalesTeamRegistry();
    const events = new BranchManagerEvents(options.publisher);

    const queueService = new QueueService(
      options.config.maxQueueSize,
      options.config.queueTtlMs,
      events,
      logger,
      now,
    );

    const strategies: Readonly<Record<AssignmentMode, IAssignmentStrategy>> = {
      [AssignmentMode.SMART_ASSIGN]: new SmartAssignStrategy(),
      [AssignmentMode.ROUND_ROBIN]: new RoundRobinStrategy(),
      [AssignmentMode.MANUAL]: new ManualAssignStrategy(),
    };

    const leadAssignmentService = new LeadAssignmentService(
      branchRegistry,
      salesTeamRegistry,
      strategies,
      queueService,
      events,
      now,
    );
    queueService.attachAssignmentService(leadAssignmentService);

    const availabilityService = new AvailabilityService(salesTeamRegistry, events, now);

    const flushQueue = new FlushQueue(salesTeamRegistry, queueService);

    return {
      assignLead: new AssignLead(leadAssignmentService, tracer),
      detectBranch: new DetectBranch(branchRegistry),
      updateSalesStatus: new UpdateSalesStatus(availabilityService, flushQueue),
      addSalesHuman: new AddSalesHuman(branchRegistry, salesTeamRegistry),
      removeSalesHuman: new RemoveSalesHuman(salesTeamRegistry),
      getBranchStatus: new GetBranchStatus(branchRegistry, salesTeamRegistry, queueService),
      getAssignmentQueue: new GetAssignmentQueue(queueService),
      flushQueue,
      getAvailableSales: new GetAvailableSales(salesTeamRegistry),
      leadAssignmentService,
      availabilityService,
      queueService,
      branchRegistry,
      salesTeamRegistry,
    };
  }
}
