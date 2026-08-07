# @aos/knowledge-graph

Enterprise Knowledge Graph — the standalone, in-memory relationship engine of the AOS platform.

## Why this package exists

Every other package in AOS manages one kind of thing: a knowledge base, a memory store, a
prompt library, a workflow definition. None of them, on their own, can answer "if I change this
Prompt, which Agents, Workflows, and Business Processes does that affect?" That question — and
its relatives (dependency discovery, impact analysis, reachability, cycle safety) — is what
`@aos/knowledge-graph` exists to answer. It models explicit, typed relationships between the
platform's entities (Knowledge, Document, Chunk, Embedding, Memory, Prompt, Agent, Workflow,
Capability, Tool, Connector, Organization, Department, Role, Employee, BusinessProcess,
SolutionPack, and a `Custom` escape hatch) as a directed graph, and provides real graph
algorithms — traversal, shortest path, cycle detection, connected components, dependency
reasoning — over it.

This is deliberately **not** the same problem as `@aos/embedding-manager` solves. Embedding
Manager answers "what is semantically similar to X?" via vector distance. Knowledge Graph answers
"what is explicitly, structurally connected to X, and how?" via typed edges a caller asserted on
purpose.

## Architecture highlight: fully standalone, zero `@aos/*` runtime dependency

This is the one property of this package worth calling out before anything else: **it imports
nothing else from the AOS monorepo at runtime.** `dependencies` in `package.json` is `{}`.
`devDependencies` contains only the shared tooling packages (`@aos/eslint-config`, `@aos/testing`,
`@aos/tsconfig`, `@aos/vitest-config`) — none of which ship in the built artifact. Confirm it
yourself:

```bash
grep -rn "@aos/" src   # every match is a comment explaining the design, never an import statement
```

Why this matters: every other Enterprise Runtime package in `005.7` composes against
`@aos/event-bus`, `@aos/runtime-kernel`, `@aos/errors`, etc. Knowledge Graph does not, on
purpose — it is meant to be the _first_ piece a host application can adopt, or the _last_ piece
still standing if everything else is stripped away, because relationship data outlives any
particular runtime wiring. To make that possible without becoming an island:

- It defines its own exception base class (`KnowledgeGraphException`) instead of extending
  `@aos/errors`' `AosError`.
- It defines its own event-publishing contract (`IKnowledgeGraphEventPublisher`) instead of
  importing `@aos/event-bus`'s `IPublisher`, with a built-in `InMemoryEventPublisher` default and
  a `NoOpEventPublisher` for hosts that don't care about events. A host that _does_ want to bridge
  onto the real AOS event bus writes a 5-line adapter class implementing the one-method interface.
- It defines its own module contract (`IKnowledgeGraphModule` — `id` + `start()` + `stop()`)
  instead of importing `@aos/runtime-kernel`'s `IModule`. `KnowledgeGraphSystem` implements it
  structurally, so any kernel that duck-types against `{ id, start, stop }` can host it without a
  compile-time dependency.

No database. No Neo4j. No GraphDB. No persistence. Everything lives in `Map`s, for the lifetime of
the process that constructs a `KnowledgeGraph`.

## Architecture: DDD / Hexagonal / SOLID / Event-Driven

```
src/
  contracts/       Locally-defined ports (IGraphAuthorizationChecker, IKnowledgeGraphEventPublisher, IKnowledgeGraphModule)
  domain/          The 12 Graph Domain aggregates + the 18/20 Node/Edge Type enums
  graph/           GraphEngine (the real in-memory data structure + adjacency indexes), merge, subgraph, validator
  nodes/, edges/    Node/Edge factories, updaters, and edge-type semantics (hierarchical/dependency/inverse/single-target)
  relationships/    GraphRelationship projection + relationship-level queries
  traversal/        BFS, DFS, shortest path, neighbors, ancestors, descendants
  analytics/        Cycle detection, connected components, average degree, graph statistics
  reasoning/        Dependency discovery, impact analysis
  queries/          The 7 Graph Query kinds, dispatched through one executor
  pipeline/         The 7-stage Graph Operation Pipeline
  middleware/       Cross-cutting pipeline wrappers (logging, timing)
  registry/         6 id-keyed Registry buckets (Graph/Node/Edge/Relationship/Snapshot/Configuration)
  factory/          GraphFactory, GraphSnapshotFactory (+ re-exports of the node/edge factories)
  manager/          The 5 Managers that own the Graph Operations
  events/           The 13 domain events + InMemoryEventPublisher/NoOpEventPublisher
  metrics/          The 8 package-wide metrics counters/gauges
  monitoring/       The 5 Monitoring dimensions (Health, Performance, Traversal Time, Memory Usage, Graph Size)
  statistics/       Thin service boundary over analytics' statistics calculator
  configuration/    ConfigurationService (defaults resolution)
  infrastructure/   Default adapter implementations (PermissiveAuthorizationChecker)
  application/      The KnowledgeGraph facade — composes the 5 Managers into one entry point
  bootstrap/        KnowledgeGraphSystem — wraps the facade as an IKnowledgeGraphModule
  errors/           KnowledgeGraphException + 10 typed subclasses
  utils/            generateId, now/highResolutionNow, deepClone
  index.ts          Curated public API surface
```

## Quick start

```typescript
import { KnowledgeGraph, KnowledgeNodeType, KnowledgeEdgeType } from "@aos/knowledge-graph";

const kg = new KnowledgeGraph();

const graph = kg.graphs.createGraph({ name: "Sales Solution Pack" });

const promptNode = kg.graphs.createNode(graph.id, {
  type: KnowledgeNodeType.Prompt,
  label: "Discovery Call Script",
});
const agentNode = kg.graphs.createNode(graph.id, {
  type: KnowledgeNodeType.Agent,
  label: "SDR Agent",
});

kg.relationships.connect(graph.id, agentNode.id, promptNode.id, KnowledgeEdgeType.Uses);

// "If I change the prompt, what's affected?"
const impact = kg.reasoning.impactAnalysis(graph.id, promptNode.id);
console.log(impact.impactedNodeIds); // [agentNode.id]

// Structural analytics.
console.log(kg.analytics.graphStatistics(graph.id));

// The 5 Monitoring dimensions and 8 package-wide Metrics.
console.log(kg.monitor.health());
console.log(kg.metrics());
```

For a kernel-hosted deployment:

```typescript
import { createKnowledgeGraphSystem } from "@aos/knowledge-graph";

const system = createKnowledgeGraphSystem();
system.start();
// system.facade is the same KnowledgeGraph facade shown above.
system.stop();
```

## Public API surface

The package exports a curated facade surface from `src/index.ts` — internal wiring (pipeline
stage functions, `GraphOperationPipeline` itself, individual algorithm modules) is **not**
exported; a consumer reaching for those has opted into an unsupported deep import.

- **Facade**: `KnowledgeGraph` (`application/`) — the single entry point most consumers need.
  Exposes `.graphs`, `.relationships`, `.traversal`, `.analytics`, `.reasoning` (the 5 Managers),
  plus `.metrics()` and `.monitor`.
- **Bootstrap**: `KnowledgeGraphSystem`, `createKnowledgeGraphSystem` — wraps the facade as an
  `IKnowledgeGraphModule`.
- **Managers**: `KnowledgeGraphManager`, `RelationshipManager`, `TraversalManager`,
  `AnalyticsManager`, `ReasoningManager`, plus `createGraphSystemContext` for advanced manual
  composition.
- **Registry**: `GraphRegistry`, `NodeRegistry`, `EdgeRegistry`, `RelationshipRegistry`,
  `SnapshotRegistry`, `ConfigurationRegistry`.
- **Factory**: `GraphFactory`, `GraphSnapshotFactory`, `KnowledgeNodeFactory`,
  `KnowledgeEdgeFactory`.
- **Events**: `KnowledgeGraphEventType`, `InMemoryEventPublisher`, `NoOpEventPublisher`.
- **Metrics / Monitoring / Statistics / Configuration**: `KnowledgeGraphMetricsCollector`,
  `KnowledgeGraphMonitor`, `GraphStatisticsService`, `ConfigurationService`.
- **Middleware**: `LoggingMiddleware`, `TimingMiddleware`.
- **Domain / contracts / errors**: the 12 aggregate types, the 18/20 type enums, the port
  interfaces, and all 11 exception classes.

## Graph Domain — the 12 aggregates

`KnowledgeNode`, `KnowledgeEdge`, `KnowledgeGraph`, `GraphRelationship`, `GraphTraversal`,
`GraphPath`, `GraphCluster`, `GraphSnapshot`, `GraphVersion`, `GraphStatistics`, `GraphMetrics`,
`GraphConfiguration`.

## Node Types (18) / Edge Types (20)

Node: `Knowledge, Document, Chunk, Embedding, Memory, Prompt, Agent, Workflow, Capability, Tool,
Connector, Organization, Department, Role, Employee, BusinessProcess, SolutionPack, Custom`.

Edge: `DependsOn, Uses, Calls, References, Generates, Consumes, Owns, Contains, Extends,
Implements, RelatedTo, ChildOf, ParentOf, DuplicateOf, DerivedFrom, VersionOf, BelongsTo,
AssignedTo, ManagedBy, Custom`.

`Custom` on either enum requires the caller to also supply `customTypeLabel`.

## Graph Operations

Create/Delete/Clone/Snapshot/Restore/Merge Graph · Create/Update/Delete/Move/Copy/Find(Node/Nodes)
· Create/Update/Delete/Find(Edge/Edges) · Connect/Disconnect/RelationshipExists · Breadth First
Search/Depth First Search/Shortest Path/Find Neighbors/Find Ancestors/Find Descendants/Sub Graph ·
Find Dependencies/Find Dependents/Impact Analysis · Cycle Detection/Connected
Components/Graph Validation/Graph Statistics.

## The 7-stage Graph Operation Pipeline

Every mutating Graph Operation runs through exactly one
`GraphOperationPipeline.execute()` call: **Validation → Authorization → Relationship Validation →
Cycle Detection → Execution → Metrics → Events**. Cycle Detection is a real, load-bearing guard —
it rejects a proposed `DependsOn`/`ChildOf`/`ParentOf`/`Contains` edge (configurable via
`cycleCheckedEdgeTypes`) if the target node can already reach the source node, i.e. committing the
edge would close a cycle in that hierarchical family.

## Development

```bash
pnpm --filter @aos/knowledge-graph build
pnpm --filter @aos/knowledge-graph lint
pnpm --filter @aos/knowledge-graph test
pnpm --filter @aos/knowledge-graph test:coverage
```

Quality bar for this package: 703+ tests, 100% statements, 95%+ branches, 100% functions, 100%
lines, 0 lint errors, 0 type errors.
