# Event Contract Flow

## Mermaid

```mermaid
flowchart LR
    P[Publisher\n(Agent / Workflow / Tool)] -->|publish per Event Contract schema| EB[Event Bus]
    EB -->|at-least-once, ordered by tenant partition| C1[Consumer A]
    EB --> C2[Consumer B]
    EB -->|delivery exhausted retries| DLQ[Dead Letter\n(Queue Contract)]
    DLQ -->|operator replay| EB
    EB -->|ingest| AW[Analytics Warehouse\n(Analytics Contract)]
```

## ASCII

```
Publisher ──publish(event_id, event_name, payload, trace_id, tenant_id)──▶ Event Bus
                                                                              │
                              ┌───────────────────────────────────────────────┼──────────────┐
                              ▼                                               ▼              ▼
                        Consumer A (idempotent)                        Consumer B      Analytics Warehouse
                              │ fail after max retries
                              ▼
                        Dead Letter Queue ──operator inspect/replay──▶ back to Event Bus
```

Every arrow in this diagram corresponds to a mandatory field in the Event Contract (`event_id`, `trace_id`, `correlation_id`, `tenant_id`, `dead_letter`) — see [`contracts/event.contract.md`](../contracts/event.contract.md).
