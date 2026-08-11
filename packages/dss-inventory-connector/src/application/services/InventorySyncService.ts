import { err, ok, type Result } from "@aos/common";
import type { Logger } from "@aos/logger";

import type { InventoryConnectorConfig, SyncMode } from "../../config/InventoryConnectorConfig.js";
import type { IConflictResolver } from "../../contracts/IConflictResolver.js";
import type { IInventorySourceAdapter } from "../../contracts/IInventorySourceAdapter.js";
import type { IInventoryStore } from "../../contracts/IInventoryStore.js";
import type { InventoryUnit } from "../../domain/entities/InventoryUnit.js";
import { SyncSession, type SyncSessionStatus } from "../../domain/entities/SyncSession.js";
import { SyncError } from "../../domain/errors/index.js";
import type { DssInventoryConnectorEvents } from "../../domain/events/DssInventoryConnectorEvents.js";
import { SourceSystem } from "../../domain/value-objects/SourceSystem.js";
import { UnitStatus } from "../../domain/value-objects/UnitStatus.js";
import type { InventorySourceRegistry } from "../../infrastructure/registry/InventorySourceRegistry.js";
import type { SourceTaggedRawUnit } from "../../types/InventoryTypes.js";

const REAL_SOURCES: ReadonlyArray<SourceSystem> = [
  SourceSystem.GOOGLE_SHEETS,
  SourceSystem.DMS,
  SourceSystem.API,
];

/** Fields compared to decide whether a re-resolved unit counts as an `UnitUpdated` (status transitions are handled separately, see `runSync`). */
function unitContentDiffers(a: InventoryUnit, b: InventoryUnit): boolean {
  return (
    a.price.toNumber() !== b.price.toNumber() ||
    a.status !== b.status ||
    a.kilometer.toNumber() !== b.kilometer.toNumber() ||
    a.color !== b.color ||
    a.condition !== b.condition ||
    a.sourceSystem !== b.sourceSystem
  );
}

/**
 * Orchestrates multi-source sync (Application Service). Fetches from every adapter attempted
 * under the configured `SyncMode` in parallel (`Promise.allSettled`), gracefully skips
 * unconfigured adapters (a log warning, never a failure), resolves conflicts via
 * `IConflictResolver`, reconciles against the current store contents (preserving unit identity
 * across syncs), updates `IInventoryStore`, and emits every event the spec's Events section lists.
 */
export class InventorySyncService {
  constructor(
    private readonly registry: InventorySourceRegistry,
    private readonly store: IInventoryStore,
    private readonly resolver: IConflictResolver,
    private readonly events: DssInventoryConnectorEvents,
    private readonly logger: Logger,
    private readonly config: Pick<InventoryConnectorConfig, "syncMode" | "tenantId">,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async syncAll(correlationId: string): Promise<Result<SyncSession, SyncError>> {
    return this.runSync(this.adaptersForMode(this.config.syncMode), correlationId);
  }

  async syncFromSource(
    source: SourceSystem,
    correlationId: string,
  ): Promise<Result<SyncSession, SyncError>> {
    const adapter = this.registry.get(source);
    if (adapter === undefined) {
      return err(new SyncError(`No adapter registered for source "${source}"`));
    }
    return this.runSync([adapter], correlationId);
  }

  private adaptersForMode(mode: SyncMode): IInventorySourceAdapter[] {
    if (mode === "MOCK") {
      const mock = this.registry.get(SourceSystem.MOCK);
      return mock === undefined ? [] : [mock];
    }
    if (mode === "LIVE") {
      return REAL_SOURCES.map((source) => this.registry.get(source)).filter(
        (adapter): adapter is IInventorySourceAdapter => adapter !== undefined,
      );
    }
    // HYBRID — every registered adapter, Mock included, so a total real-source failure still
    // yields Mock's data (SourcePriority.MOCK is lowest, so real data always wins when present).
    return [...this.registry.listAll()];
  }

  private async runSync(
    attempted: ReadonlyArray<IInventorySourceAdapter>,
    correlationId: string,
  ): Promise<Result<SyncSession, SyncError>> {
    const sources = attempted.map((adapter) => adapter.sourceSystem);
    const sessionId = `sync-${this.now().getTime()}-${Math.random().toString(36).slice(2, 8)}`;
    const session = SyncSession.start(sessionId, sources, this.now());

    const configured: IInventorySourceAdapter[] = [];
    for (const adapter of attempted) {
      if (adapter.isConfigured()) {
        configured.push(adapter);
      } else {
        this.logger.warn(
          { source: adapter.sourceSystem },
          "dss-inventory-connector: adapter not configured, skipping",
        );
      }
    }

    if (configured.length === 0) {
      const message =
        this.config.syncMode === "LIVE"
          ? "LIVE sync mode requires at least one configured real adapter (Google Sheets, DMS, or API)"
          : "No adapters configured for this sync";
      return this.fail(session, sources, [message], correlationId);
    }

    const settled = await Promise.allSettled(configured.map((adapter) => adapter.fetchUnits()));
    const rawPool: SourceTaggedRawUnit[] = [];
    const errors: string[] = [];

    settled.forEach((result, index) => {
      const adapter = configured[index]!;
      if (result.status === "fulfilled") {
        if (result.value.ok) {
          for (const raw of result.value.value) {
            rawPool.push({ ...raw, sourceSystem: adapter.sourceSystem });
          }
        } else {
          errors.push(`${adapter.sourceSystem}: ${result.value.error.message}`);
        }
      } else {
        const reason =
          result.reason instanceof Error ? result.reason.message : String(result.reason);
        errors.push(`${adapter.sourceSystem}: ${reason}`);
      }
    });

    if (errors.length === configured.length) {
      return this.fail(session, sources, errors, correlationId);
    }

    const resolved = this.resolver.resolve(rawPool);
    const existingByKey = new Map<string, InventoryUnit>();
    for (const unit of this.store.getAll()) {
      existingByKey.set(this.resolver.compositeKeyOf(unit), unit);
    }

    let unitsAdded = 0;
    let unitsUpdated = 0;
    let unitsSold = 0;
    const at = this.now();

    for (const candidate of resolved) {
      const key = this.resolver.compositeKeyOf(candidate);
      const existing = existingByKey.get(key);
      const final = existing === undefined ? candidate : this.resolver.merge(existing, candidate);
      this.store.upsert(final);

      if (existing === undefined) {
        unitsAdded += 1;
        await this.events.publishUnitAdded({
          unitId: final.id.toString(),
          brand: final.brand.toString(),
          model: final.model.toString(),
          branch: final.branch,
          priceIDR: final.price.toNumber(),
          sourceSystem: final.sourceSystem,
          tenantId: this.config.tenantId,
          correlationId,
          occurredAt: at,
          version: "1.0",
        });
      } else if (final.status === UnitStatus.SOLD && existing.status !== UnitStatus.SOLD) {
        unitsSold += 1;
        await this.events.publishUnitSold({
          unitId: final.id.toString(),
          brand: final.brand.toString(),
          model: final.model.toString(),
          branch: final.branch,
          priceIDR: final.price.toNumber(),
          tenantId: this.config.tenantId,
          correlationId,
          occurredAt: at,
          version: "1.0",
        });
      } else if (unitContentDiffers(existing, final)) {
        unitsUpdated += 1;
        await this.events.publishUnitUpdated({
          unitId: final.id.toString(),
          changedFields: diffFields(existing, final),
          tenantId: this.config.tenantId,
          correlationId,
          occurredAt: at,
          version: "1.0",
        });
      }

      if (final.status === UnitStatus.RESERVED && existing?.status !== UnitStatus.RESERVED) {
        await this.events.publishUnitReserved({
          unitId: final.id.toString(),
          brand: final.brand.toString(),
          model: final.model.toString(),
          branch: final.branch,
          tenantId: this.config.tenantId,
          correlationId,
          occurredAt: at,
          version: "1.0",
        });
      }
    }

    const status: SyncSessionStatus = errors.length > 0 ? "PARTIAL" : "COMPLETED";
    const completed = session.complete({
      unitsAdded,
      unitsUpdated,
      unitsSold,
      errors,
      status,
      completedAt: at,
    });

    await this.events.publishSyncCompleted({
      sessionId,
      sources,
      status,
      unitsAdded,
      unitsUpdated,
      unitsSold,
      errors,
      tenantId: this.config.tenantId,
      correlationId,
      occurredAt: at,
      version: "1.0",
    });
    await this.events.publishInventoryChanged({
      sessionId,
      added: unitsAdded,
      updated: unitsUpdated,
      sold: unitsSold,
      tenantId: this.config.tenantId,
      correlationId,
      occurredAt: at,
      version: "1.0",
    });

    return ok(completed);
  }

  private async fail(
    session: SyncSession,
    sources: ReadonlyArray<SourceSystem>,
    errors: ReadonlyArray<string>,
    correlationId: string,
  ): Promise<Result<SyncSession, SyncError>> {
    const at = this.now();
    const failed = session.complete({
      unitsAdded: 0,
      unitsUpdated: 0,
      unitsSold: 0,
      errors,
      status: "FAILED",
      completedAt: at,
    });
    await this.events.publishSyncFailed({
      sessionId: session.id,
      sources,
      errors,
      tenantId: this.config.tenantId,
      correlationId,
      occurredAt: at,
      version: "1.0",
    });
    return ok(failed);
  }
}

function diffFields(a: InventoryUnit, b: InventoryUnit): string[] {
  const fields: string[] = [];
  if (a.price.toNumber() !== b.price.toNumber()) {
    fields.push("price");
  }
  if (a.status !== b.status) {
    fields.push("status");
  }
  if (a.kilometer.toNumber() !== b.kilometer.toNumber()) {
    fields.push("kilometer");
  }
  if (a.color !== b.color) {
    fields.push("color");
  }
  if (a.condition !== b.condition) {
    fields.push("condition");
  }
  if (a.sourceSystem !== b.sourceSystem) {
    fields.push("sourceSystem");
  }
  return fields;
}
