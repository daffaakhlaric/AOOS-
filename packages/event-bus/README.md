# @aos/event-bus

The AOS Enterprise Event Bus — the core, in-process Event Contract / Dispatcher /
Publisher / Subscriber infrastructure every Runtime component is meant to communicate
through. **Not a simple `EventEmitter`. Not a naive Pub/Sub.** See
`docs/PROMPT-005.4-ENTERPRISE-EVENT-BUS.md` for the explicit scope boundary (no Workflow
Runtime, Scheduler, Agent Runtime, Tool Runtime, or Memory Engine ships here).

## The Event Contract

Every event carries: Event ID, `type` (namespace-qualified, e.g. `"agent.created"`),
Category, Correlation ID, Causation ID, Tenant ID, Source, Producer, Timestamp, Priority,
Version, Schema Version, Payload, Metadata, Trace ID.

```ts
import { EventBroker, EventCategory } from "@aos/event-bus";

const bus = new EventBroker();

bus.subscribe({
  criteria: { namespace: "agent" },
  handler: (event) => console.log(event.type, event.payload),
});

await bus.publish({
  type: "agent.created",
  category: EventCategory.DOMAIN,
  payload: { agentId: "content-manager" },
  source: "agent-runtime",
  producer: "agent-service",
});
```

7 Event categories ship as their own Zod schema, each extending the shared
`baseEventSchema`: Domain, System, Infrastructure, Lifecycle, Audit, Monitoring,
Simulation.

## Architecture: Validator → Publisher → Dispatcher → Subscription Manager

`EventBroker` (`broker/event-broker.ts`) is the composition root — the same pattern
`RegistrySystem` (`@aos/registry`) and `Kernel` (`@aos/runtime-kernel`) use:

1. **Publisher** (`publisher/event-publisher.ts`) fills every generated Event Contract
   field (id, timestamp, correlationId, priority via `PriorityResolver`), then runs the
   **Validation Pipeline** (`validator/validation-pipeline.ts`: Schema → Version → Payload
   → Tenant).
2. On success, the **Dispatcher** (`dispatcher/event-dispatcher.ts`) asks the
   **Subscription Manager** (`subscriber/subscription-manager.ts`) which subscriptions
   match — via the **Router** (Namespace/Topic/Pattern/Tenant/Category/Priority) and each
   subscription's **Filters** (Tenant/Capability/Namespace/Type/Version) — then delivers
   to each under its **Retry Policy** (Exponential/Linear Backoff), reporting **Metrics**
   (Published/Delivered/Dropped/Retried/Rejected/Latency/Queue Depth/Subscriber Count) and
   **Tracing** (Correlation ID/Trace ID/Span) throughout.
3. A delivery whose retries are exhausted is reported as dropped and, if an
   `IDeadLetterQueue` is configured, enqueued there.

## Event Namespaces

`agent.*`, `workflow.*`, `tool.*`, `registry.*`, `scheduler.*`, `memory.*`, `planning.*`,
`reasoning.*`, `reflection.*`, `analytics.*`, `simulation.*`, `tenant.*`, `system.*`,
`audit.*`, `monitoring.*`, and `capability.*` (added per the 005.4 addendum so 005.8's
Tool SDK can publish `capability.resolved`/`capability.failed`/`capability.deprecated`
without a future contract change).

## Folder Structure

| Folder             | Contents                                                                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `contracts/`       | `baseEventSchema` + the 7 category schemas, `EventPriority`, `EVENT_NAMESPACES`, `IRetryPolicy`                                         |
| `broker/`          | `EventBroker` — the public façade                                                                                                       |
| `publisher/`       | `EventPublisher` (Publish/PublishAsync/PublishBatch), `IDelayedPublisher`/`IScheduledPublisher` (interfaces only)                       |
| `subscriber/`      | `SubscriptionManager` (Subscribe/Unsubscribe/Wildcard/Namespace/Priority Subscription)                                                  |
| `dispatcher/`      | `EventDispatcher`                                                                                                                       |
| `router/`          | `EventRouter` — Namespace/Topic/Pattern/Tenant/Category/Priority matching                                                               |
| `filter/`          | `TenantFilter`/`CapabilityFilter`/`NamespaceFilter`/`TypeFilter`/`VersionFilter`/`FilterChain`                                          |
| `validator/`       | `SchemaValidator`/`VersionValidator`/`PayloadValidator`/`TenantValidator`/`ValidationPipeline`, `IPermissionValidator` (interface only) |
| `retry/`           | `ExponentialBackoffPolicy`, `LinearBackoffPolicy`, `RetryExecutor`                                                                      |
| `dead-letter/`     | `IDeadLetterQueue` — interface only, no persistence                                                                                     |
| `replay/`          | `IEventReplay` — interface only, no storage                                                                                             |
| `store-interface/` | `IEventStore`/`IEventSnapshotStore`/`IEventReplayProvider`/`IEventArchiveProvider` — Event Sourcing readiness, interfaces only          |
| `buffer/`          | `MemoryBuffer`, `PriorityQueue`, `BatchQueue`                                                                                           |
| `priority/`        | `priorityRank`/`comparePriority`, `PriorityResolver`                                                                                    |
| `metrics/`         | `EventBusMetricsCollector`                                                                                                              |
| `tracing/`         | `TraceContext`, `ITracer`, `InMemoryTracer` (OpenTelemetry-ready port)                                                                  |
| `health/`          | `EventBusHealth` — Publisher/Subscriber/Dispatcher/Router/Broker Health                                                                 |
| `monitoring/`      | `BusMonitor` — combines Metrics + Health into one sample                                                                                |
| `serializer/`      | `JsonSerializer` (MessagePack/Avro reserved for later)                                                                                  |
| `events/`          | `EventBusEventEmitter` — internal bus operational notifications, distinct from the Event Contract                                       |
| `errors/`          | `EventBusException` + `Validation/Routing/Publish/Subscription/RetryExhaustedException`                                                 |
| `config/`          | `EventBusConfig`                                                                                                                        |
| `bootstrap/`       | `EventBusSystem` — implements `@aos/runtime-kernel`'s `IModule`                                                                         |

## Event Sourcing readiness (not implemented)

`store-interface/` ships `IEventStore`, `IEventSnapshotStore`, `IEventReplayProvider`, and
`IEventArchiveProvider` as pure interfaces — no database-backed implementation exists in
this package. They exist so a future durable-storage package can implement them without
another Event Bus contract change, enabling: replaying AI Agent activity, auditing AI
decisions, re-simulating scenarios, and re-training/re-evaluating agent strategy from
event history.

## Persistence

None. Every component (Subscription Manager, Buffer, Metrics) is in-memory only.

## Testing

Run `pnpm test`, `pnpm test:coverage`, `pnpm lint`, `pnpm build`, `pnpm typecheck`. See
`docs/005.4-EVENT-BUS-REPORT.md` for coverage numbers, known limitations, and the
readiness checklist for Engineering Task 005.5 (Scheduler) — **not implemented in this
package**.
