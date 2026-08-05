# 003 — AOS Domain Driven Design & Business Domain Blueprint

**Status:** ACTIVE — Business Domain Single Source of Truth
**Governs under:** [`001-ENGINEERING-CONSTITUTION.md`](./001-ENGINEERING-CONSTITUTION.md) and [`002-ENTERPRISE-ARCHITECTURE.md`](./002-ENTERPRISE-ARCHITECTURE.md)
**Scope:** Business domain design only — no code, no runtime implementation, no agent implementation, no API implementation.

---

## 0. Conformance Check

Both prior documents were read in full before drafting this blueprint. No conflicts were found:

- The Bounded Context list below is the concrete instantiation of the Bounded Context concept mandated by Constitution §3.8 (DDD) and used throughout Architecture §2 (Product Architecture) and ADR-004.
- Every Aggregate obeys Constitution RULE-016/017 (tenant scoping) and RULE-027 (a Bounded Context owns its own data).
- Every Domain Event obeys Architecture §16 (Event Driven Architecture) and Constitution RULE-034–037 (event schema, tolerant reader, idempotent consumers).
- No conflict required an ADR in this document. If a future domain requirement conflicts with a RULE, it will be flagged here with `⚠ CONFLICT` referencing the RULE number before any change is made, per Constitution §0.2.

---

## 1. Executive Summary

This document is the Business Domain Blueprint for AOS. It defines _what the business is_, independent of _how it runs_ (Architecture, doc 002) and _what governs how code is written_ (Constitution, doc 001). It is the shared model that Database schemas, the Workflow Runtime, the API surface, the Dashboard, every AI Agent, the Memory Service, and Analytics all derive from.

It covers 20 Business Capabilities, 14 Bounded Contexts, 37 Entities, 18 Value Objects, 17 Domain Services, 138 Domain Events, 112 Commands, 112 Queries, and 112 Business Rules, plus 10 State Machines, a full Event Storming timeline, an ER Diagram, and governance artifacts (Permission Matrix, Tenant Isolation Model, Naming Conventions, Validation Rules, KPI definitions, and a Reporting Model).

The domain narrative, in one line: **a Lead enters through Marketing, is Qualified by AI, Nurtured until Hot, converted through Appointment → Test Drive → Quotation → SPK → Delivery, and retained — with every step observable, AI-driven by default, and human-supervised only at the Hot Lead and exception boundaries.**

---

## 2. Domain Vision

AOS exists to make the automotive dealer's entire top-of-funnel-to-handoff pipeline autonomous, while keeping the parts of the business that are irreducibly human — closing, delivery, relationship — in human hands, fed only high-quality, AI-qualified opportunities.

**Vision statement:** _Every dealer's marketing, lead management, and customer engagement should run as a self-operating digital organism — AI plans, creates, targets, converses, and qualifies; humans close deals and build relationships._

**Domain success criteria:**

- A Lead never goes unattended for longer than its Nurturing Policy allows.
- Sales staff time is spent exclusively on Hot Leads and human-only steps (Test Drive, Quotation negotiation, Delivery).
- Every AI decision in the domain (score, qualify, hand off, optimize spend) is explainable from Domain Events alone.
- The domain model scales from a single-branch dealer to a multi-branch, multi-brand dealer group without a model change — only new Aggregate instances.

---

## 3. Business Capabilities

| #   | Capability                                 | Definition                                                 | Primary Bounded Context(s)        |
| --- | ------------------------------------------ | ---------------------------------------------------------- | --------------------------------- |
| 1   | Marketing                                  | Plans and executes campaigns across channels toward Leads  | Marketing                         |
| 2   | Social Media                               | Publishes and manages organic social presence              | Content, Marketing                |
| 3   | Advertising                                | Manages paid ad campaigns, targeting, and spend            | Ads                               |
| 4   | CRM                                        | Maintains customer/lead relationship records and lifecycle | CRM                               |
| 5   | Lead Generation                            | Captures new Leads from all channels                       | Marketing, Lead                   |
| 6   | Lead Qualification                         | Scores and classifies Lead readiness                       | Lead, AI Runtime                  |
| 7   | Lead Nurturing                             | Engages Leads over time until conversion-ready             | CRM, Lead                         |
| 8   | Sales                                      | Manages the human-facing deal process                      | Sales                             |
| 9   | Appointment                                | Schedules and tracks dealership visits                     | Sales                             |
| 10  | Test Drive                                 | Manages test drive scheduling and completion               | Sales                             |
| 11  | Quotation                                  | Produces and negotiates price quotes                       | Sales                             |
| 12  | SPK (Surat Pesanan Kendaraan / Order Form) | Manages binding vehicle order documentation                | Sales                             |
| 13  | Delivery                                   | Coordinates vehicle handover to customer                   | Sales                             |
| 14  | Analytics                                  | Measures funnel, ROI, and performance                      | Analytics                         |
| 15  | AI Runtime                                 | Executes autonomous Agent plans and actions                | AI Runtime                        |
| 16  | Knowledge                                  | Maintains dealer/product/policy knowledge for AI use       | Knowledge                         |
| 17  | Learning                                   | Improves Agent/prompt/model performance over time          | Knowledge, AI Runtime, Simulation |
| 18  | Omnichannel                                | Unifies communication across all customer channels         | CRM, Notification                 |
| 19  | Notification                               | Delivers alerts/messages to humans and systems             | Notification                      |
| 20  | Identity                                   | Manages tenants, users, roles, and access                  | Identity                          |
| 21  | Billing                                    | Manages subscription, usage, and invoicing                 | Billing                           |

---

## 4. Domain Landscape

```
                         ┌───────────────────────────────────────────┐
                         │              CORE DOMAIN                   │
                         │   Lead • CRM • Sales • Marketing • Ads      │
                         │   (This is where AOS wins or loses)         │
                         └───────────────────────────────────────────┘
                         ┌───────────────────────────────────────────┐
                         │           SUPPORTING DOMAIN                 │
                         │  Content • AI Runtime • Knowledge •         │
                         │  Analytics • Workflow • Notification        │
                         └───────────────────────────────────────────┘
                         ┌───────────────────────────────────────────┐
                         │            GENERIC DOMAIN                   │
                         │      Identity • Billing • Simulation        │
                         └───────────────────────────────────────────┘
```

**Core Domain** — where competitive differentiation lives; deserves the most design and AI investment (best Agents, richest Memory, tightest Guardrails).
**Supporting Domain** — necessary for the Core Domain to function autonomously but not itself differentiating; can lean on off-the-shelf patterns.
**Generic Domain** — solved problems (auth, billing, testing infra); build to a good-enough standard and avoid over-investment.

---

## 5. Ubiquitous Language

| Term                   | Meaning (binding across all contexts, code, and conversation)                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Lead**               | A prospective customer captured by the platform, not yet a Customer of record until a qualifying interaction occurs. |
| **Hot Lead**           | A Lead whose Lead Score has crossed the tenant's hot threshold (default ≥ 80) and is handed to Sales.                |
| **Nurturing**          | The AI-driven, multi-touch engagement process keeping a Lead warm until conversion-ready.                            |
| **Campaign**           | A time-boxed, budgeted, objective-driven marketing initiative composed of Content/Ads targeted at an Audience.       |
| **Audience**           | A defined segment of Leads/Customers a Campaign targets.                                                             |
| **SPK**                | Surat Pesanan Kendaraan — the binding vehicle order form created after a Quotation is accepted.                      |
| **Hot Lead Threshold** | The tenant-configurable Lead Score value above which a Lead becomes Hot.                                             |
| **Agent**              | An autonomous AI actor operating within a Bounded Context, per Constitution §11.                                     |
| **Guardrail**          | A pre-action policy check gating irreversible/costly Agent actions, per Constitution §11.7.                          |
| **Dealer**             | A tenant of AOS — one automotive dealership business (may span multiple Branches).                                   |
| **Branch**             | A physical dealership location belonging to a Dealer.                                                                |
| **Working Hour**       | The tenant/branch-configured hours during which customer-facing automation may act.                                  |
| **Reflection**         | The AI Runtime's post-action self-evaluation step producing a confidence score.                                      |

This glossary is binding: code identifiers, event names, and UI copy MUST use these terms exactly (Constitution §6 Naming Conventions extends here — see §26).

---

## 6. Bounded Context

| Context                  | Responsibility                                                                     | Type       |
| ------------------------ | ---------------------------------------------------------------------------------- | ---------- |
| **Marketing Context**    | Campaign planning, objective-setting, budget allocation, Audience definition       | Core       |
| **Sales Context**        | Appointment, Test Drive, Quotation, SPK, Delivery — the human-facing deal pipeline | Core       |
| **CRM Context**          | Customer/Lead relationship record, Conversation history, Nurturing orchestration   | Core       |
| **Lead Context**         | Lead capture, deduplication, scoring, qualification, assignment                    | Core       |
| **Content Context**      | Content/Creative generation, approval, scheduling, publishing                      | Supporting |
| **Ads Context**          | Ad creation, publishing, spend tracking, performance evaluation                    | Core       |
| **Analytics Context**    | Funnel, attribution, cohort, ROI measurement and reporting                         | Supporting |
| **Workflow Context**     | Workflow/Task orchestration and lifecycle across all other contexts                | Supporting |
| **AI Runtime Context**   | Agent execution, Planning, Reflection, Guardrail enforcement                       | Supporting |
| **Knowledge Context**    | Product/dealer/policy knowledge base and retrieval                                 | Supporting |
| **Billing Context**      | Subscription, usage metering, invoicing                                            | Generic    |
| **Identity Context**     | Tenant, User, Role, Permission management                                          | Generic    |
| **Notification Context** | Alert/message dispatch to humans and systems                                       | Supporting |
| **Simulation Context**   | Offline scenario evaluation and canary gating for Agent/prompt changes             | Generic    |

Each context owns its own data (Constitution RULE-027) and communicates cross-context only via Domain Events (RULE-023).

---

## 7. Context Mapping

```
Marketing ──(Partnership)── Ads ──(Partnership)── Content
     │
     │ (Customer/Supplier: Marketing is upstream)
     ▼
   Lead ──(Customer/Supplier: Lead is upstream)──▶ CRM ──(Customer/Supplier)──▶ Sales
     │                                                   │
     │ (Open Host Service: emits lead.* events)           │ (Open Host Service: emits appointment.*, spk.* etc.)
     ▼                                                   ▼
AI Runtime ◄──(Conformist: consumes Knowledge as-is)── Knowledge
     │
     │ (Open Host Service: emits agent.*, reflection.* events)
     ▼
Workflow ──(Shared Kernel: Event schema + Trace propagation)── Analytics, Notification

Identity ──(Anti-Corruption Layer, all contexts)── every other context
Billing ──(Anti-Corruption Layer)── Identity (reads tenant/plan, never writes into Identity)
Simulation ──(Customer/Supplier: consumes Registry/AI Runtime contracts as a read-only test harness)
```

**Relationship legend:**

- **Partnership** — two contexts co-evolve their contracts jointly (Marketing/Ads/Content ship campaign features together).
- **Customer/Supplier** — downstream context depends on upstream's published contract; upstream must consider downstream impact before breaking changes.
- **Conformist** — downstream simply accepts upstream's model as-is (AI Runtime conforms to Knowledge's shape rather than translating it).
- **Open Host Service** — a context publishes a stable, versioned event/API contract for many consumers (Lead, Sales, AI Runtime, Workflow all do this).
- **Anti-Corruption Layer (ACL)** — Identity and Billing are accessed only through translation adapters so their internal model never leaks into other contexts (Architecture §29, RULE-025).
- **Shared Kernel** — Event schema conventions and trace propagation are the one deliberately shared contract across all contexts (Architecture §16).

---

## 8. Aggregates

An Aggregate is the transactional consistency boundary; only the Aggregate Root is referenced from outside.

| Context                                  | Aggregate Root                      | Contains                                                                         |
| ---------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------- |
| Marketing                                | **Campaign**                        | CampaignBudget (VO), CampaignObjective (VO), Audience references, DateRange (VO) |
| Ads                                      | **Ads**                             | Creative reference, Budget (VO), Performance snapshot                            |
| Content                                  | **Content**                         | Creative(s), ApprovalState                                                       |
| Lead                                     | **Lead**                            | LeadScore (VO), Source, AssignmentState                                          |
| CRM                                      | **Customer**                        | Address (VO), Phone (VO), Email (VO), Conversation references                    |
| CRM                                      | **Conversation**                    | Message thread, Channel                                                          |
| Sales                                    | **Appointment**                     | DateRange (VO), Branch reference                                                 |
| Sales                                    | **Quotation**                       | Money (VO) line items, Vehicle/Variant references                                |
| Sales                                    | **SPK**                             | Quotation reference, Customer reference, Vehicle allocation                      |
| Sales                                    | **Delivery**                        | SPK reference, Vehicle reference, DeliveryDate                                   |
| Inventory (sub of Sales/CRM shared read) | **Vehicle**                         | Variant(s), Inventory count                                                      |
| Workflow                                 | **Workflow**                        | Task(s), execution state                                                         |
| AI Runtime                               | **Agent** (runtime instance record) | Plan, Action log, Reflection outcome                                             |
| Knowledge                                | **Knowledge**                       | Source document, embedding reference                                             |
| Billing                                  | **Subscription**                    | Plan, Invoice references                                                         |
| Identity                                 | **Tenant**                          | Branch(es), User(s), Role assignments                                            |
| Notification                             | **Notification**                    | Channel, delivery status                                                         |
| Simulation                               | **Scenario**                        | Expected outcome, run history                                                    |

**Rule:** Cross-aggregate references are by ID only, never by object embedding, so each Aggregate can be persisted/scaled independently (consistent with Constitution RULE-016 tenant-scoped storage and §3.10 Clean Architecture).

---

## 9. Entity

| Entity        | Owning Context                    | Key Attributes (illustrative, not schema)            |
| ------------- | --------------------------------- | ---------------------------------------------------- |
| Dealer        | Identity                          | name, region, tier, dataResidency                    |
| Branch        | Identity                          | dealerId, address, workingHour                       |
| Sales (staff) | Identity                          | branchId, role, quota                                |
| Manager       | Identity                          | branchId, scope                                      |
| Customer      | CRM                               | name, phone, email, lifecycleStage                   |
| Lead          | Lead                              | source, score, status, assignedTo                    |
| Campaign      | Marketing                         | objective, budget, dateRange, status                 |
| Ads           | Ads                               | campaignId, platform, spend, status                  |
| Audience      | Marketing                         | segmentCriteria, size                                |
| Vehicle       | Sales (Inventory)                 | model, brand, variants                               |
| Variant       | Sales (Inventory)                 | trim, color, price                                   |
| Inventory     | Sales (Inventory)                 | branchId, vehicleId, quantity                        |
| Content       | Content                           | type, status, campaignId                             |
| Creative      | Content                           | assetRef, format                                     |
| Workflow      | Workflow                          | definitionRef, status, currentStep                   |
| Task          | Workflow                          | workflowId, assignee (human or Agent), status        |
| Agent         | AI Runtime                        | type, version, allowedTools, costCeiling             |
| Tool          | AI Runtime                        | type, permissionClass, sideEffectClass               |
| Prompt        | Knowledge/AI Runtime              | version, registryRef                                 |
| Memory        | AI Runtime                        | tenantId, entityId, type (working/episodic/semantic) |
| Knowledge     | Knowledge                         | sourceType, freshness, tenantScope                   |
| Goal          | Marketing/AI Runtime              | targetMetric, targetValue, deadline                  |
| Event         | (cross-cutting, logged not owned) | type, payload, traceId                               |
| Budget        | Marketing/Ads                     | amount, period, ceiling                              |
| Appointment   | Sales                             | leadId/customerId, branchId, dateTime                |
| Quotation     | Sales                             | customerId, vehicleId, priceLines                    |
| SPK           | Sales                             | quotationId, status, signedAt                        |
| Delivery      | Sales                             | spkId, deliveryDate, status                          |
| Activity      | CRM                               | actorType (Agent/Human), action, timestamp           |
| Notification  | Notification                      | recipient, channel, status                           |
| Conversation  | CRM                               | customerId, channel, messages                        |
| Tenant        | Identity                          | plan, status, region                                 |
| User          | Identity                          | tenantId, role, email                                |
| Role          | Identity                          | permissions                                          |
| Subscription  | Billing                           | tenantId, planId, status                             |
| Invoice       | Billing                           | subscriptionId, amount, status                       |
| Plan          | Billing                           | tier, priceModel, featureSet                         |

37 Entities total, meeting and exceeding the minimum list from the source prompt.

---

## 10. Value Object

| Value Object       | Definition                                                     | Used By                        |
| ------------------ | -------------------------------------------------------------- | ------------------------------ |
| Money              | amount + currency, immutable                                   | Quotation, Budget, Invoice     |
| Phone              | E.164-normalized phone number                                  | Customer, Lead                 |
| Email              | validated email address                                        | Customer, Lead, User           |
| Address            | street/city/region/postal/country                              | Customer, Branch               |
| Coordinate         | lat/long                                                       | Branch, Audience geo-targeting |
| Score              | generic 0–100 normalized score                                 | Lead, Content performance      |
| Lead Score         | Score specialized with contributing factors                    | Lead                           |
| Campaign Budget    | Money + period + ceiling + spent-to-date                       | Campaign, Ads                  |
| Campaign Objective | enum (Awareness/Lead Gen/Conversion/Retention) + target metric | Campaign                       |
| Brand              | vehicle brand identifier                                       | Vehicle                        |
| Vehicle Model      | brand + model name                                             | Vehicle                        |
| Trim               | variant trim level                                             | Variant                        |
| Color              | exterior/interior color code                                   | Variant, Inventory             |
| License Plate      | jurisdiction-formatted plate string                            | Delivery                       |
| Date Range         | start + end, validated start ≤ end                             | Campaign, Appointment          |
| Working Hour       | day-of-week + open/close time                                  | Branch                         |
| Confidence Score   | 0–1 float, AI decision certainty                               | Agent, Reflection              |
| Trace ID           | correlation identifier                                         | Event, Activity                |

18 Value Objects, all immutable by definition (Constitution §2.8).

---

## 11. Domain Services

Domain Services hold logic that doesn't naturally belong to a single Entity/Aggregate.

| Domain Service               | Responsibility                                         | Context        |
| ---------------------------- | ------------------------------------------------------ | -------------- |
| LeadScoringService           | Computes Lead Score from behavioral + profile signals  | Lead           |
| QualificationPolicyService   | Applies tenant-configured qualification thresholds     | Lead           |
| DedupeService                | Detects and merges duplicate Leads/Customers           | Lead, CRM      |
| NurturingSequenceService     | Determines next best nurturing action                  | CRM            |
| AttributionService           | Assigns conversion credit across touchpoints           | Analytics      |
| BudgetAllocationService      | Distributes budget across Campaigns/Ads within ceiling | Marketing, Ads |
| CampaignOptimizationService  | Recommends/applies campaign parameter changes          | Marketing, Ads |
| ContentGenerationService     | Produces content drafts from brief + brand knowledge   | Content        |
| ConversationRoutingService   | Routes inbound messages to the right Agent/human       | CRM            |
| AppointmentSchedulingService | Resolves available slots respecting Working Hour       | Sales          |
| QuotationCalculationService  | Computes price lines, discounts, taxes                 | Sales          |
| DeliveryCoordinationService  | Sequences vehicle allocation and handover steps        | Sales          |
| NotificationDispatchService  | Selects channel and formats outbound notifications     | Notification   |
| KnowledgeRetrievalService    | Resolves relevant knowledge snippets (RAG)             | Knowledge      |
| ReflectionScoringService     | Evaluates Agent action outcomes and confidence         | AI Runtime     |
| TenantProvisioningService    | Sets up a new Dealer tenant's initial configuration    | Identity       |
| BillingCalculationService    | Computes usage-based charges                           | Billing        |

---

## 12. Domain Events (Catalog — 138 events)

Naming follows Constitution RULE §6.4: `<domain>.<entity><PastTenseVerb>`. Codes below (EVT-###) are for cross-reference only, not part of the event name itself.

### 12.1 Marketing / Campaign (15)

| Code    | Event                    |
| ------- | ------------------------ |
| EVT-001 | CampaignCreated          |
| EVT-002 | CampaignPublished        |
| EVT-003 | CampaignStarted          |
| EVT-004 | CampaignPaused           |
| EVT-005 | CampaignResumed          |
| EVT-006 | CampaignCompleted        |
| EVT-007 | CampaignOptimized        |
| EVT-008 | CampaignBudgetAllocated  |
| EVT-009 | CampaignBudgetExhausted  |
| EVT-010 | CampaignBudgetExceeded   |
| EVT-011 | CampaignObjectiveChanged |
| EVT-012 | CampaignArchived         |
| EVT-013 | AudienceCreated          |
| EVT-014 | AudienceUpdated          |
| EVT-015 | AudienceSegmentGenerated |

### 12.2 Ads (10)

| Code    | Event                   |
| ------- | ----------------------- |
| EVT-016 | AdsCreated              |
| EVT-017 | AdsPublished            |
| EVT-018 | AdsRejected             |
| EVT-019 | AdsPaused               |
| EVT-020 | AdsResumed              |
| EVT-021 | AdsPerformanceEvaluated |
| EVT-022 | AdsCreativeSwapped      |
| EVT-023 | AdsSpendRecorded        |
| EVT-024 | AdsCTRDropped           |
| EVT-025 | AdsBudgetReallocated    |

### 12.3 Content (10)

| Code    | Event                    |
| ------- | ------------------------ |
| EVT-026 | ContentRequested         |
| EVT-027 | ContentGenerated         |
| EVT-028 | ContentApproved          |
| EVT-029 | ContentRejected          |
| EVT-030 | ContentPublished         |
| EVT-031 | ContentScheduled         |
| EVT-032 | CreativeGenerated        |
| EVT-033 | CreativeVariantSelected  |
| EVT-034 | ContentPerformanceScored |
| EVT-035 | ContentArchived          |

### 12.4 Lead (15)

| Code    | Event            |
| ------- | ---------------- |
| EVT-036 | LeadCreated      |
| EVT-037 | LeadEnriched     |
| EVT-038 | LeadDeduplicated |
| EVT-039 | LeadScored       |
| EVT-040 | LeadQualified    |
| EVT-041 | LeadDisqualified |
| EVT-042 | LeadRejected     |
| EVT-043 | LeadHot          |
| EVT-044 | LeadWarm         |
| EVT-045 | LeadCold         |
| EVT-046 | LeadAssigned     |
| EVT-047 | LeadReassigned   |
| EVT-048 | LeadExpired      |
| EVT-049 | LeadReengaged    |
| EVT-050 | LeadArchived     |

### 12.5 CRM / Conversation / Nurturing (15)

| Code    | Event                      |
| ------- | -------------------------- |
| EVT-051 | CustomerCreated            |
| EVT-052 | CustomerProfileUpdated     |
| EVT-053 | CustomerMerged             |
| EVT-054 | ConversationStarted        |
| EVT-055 | CustomerReplied            |
| EVT-056 | MessageSent                |
| EVT-057 | MessageDelivered           |
| EVT-058 | MessageFailed              |
| EVT-059 | NurturingSequenceStarted   |
| EVT-060 | NurturingStepCompleted     |
| EVT-061 | NurturingSequenceCompleted |
| EVT-062 | FollowUpScheduled          |
| EVT-063 | FollowUpMissed             |
| EVT-064 | CustomerOptedOut           |
| EVT-065 | CustomerReengaged          |

### 12.6 Sales Pipeline: Appointment → Test Drive → Quotation → SPK → Delivery (20)

| Code    | Event                  |
| ------- | ---------------------- |
| EVT-066 | AppointmentRequested   |
| EVT-067 | AppointmentBooked      |
| EVT-068 | AppointmentConfirmed   |
| EVT-069 | AppointmentRescheduled |
| EVT-070 | AppointmentCancelled   |
| EVT-071 | AppointmentNoShow      |
| EVT-072 | TestDriveScheduled     |
| EVT-073 | TestDriveStarted       |
| EVT-074 | TestDriveCompleted     |
| EVT-075 | TestDriveCancelled     |
| EVT-076 | QuotationCreated       |
| EVT-077 | QuotationRevised       |
| EVT-078 | QuotationApproved      |
| EVT-079 | QuotationExpired       |
| EVT-080 | QuotationRejected      |
| EVT-081 | SPKCreated             |
| EVT-082 | SPKApproved            |
| EVT-083 | SPKCancelled           |
| EVT-084 | VehicleAllocated       |
| EVT-085 | VehicleDelivered       |

### 12.7 Vehicle / Inventory (8)

| Code    | Event               |
| ------- | ------------------- |
| EVT-086 | VehicleRegistered   |
| EVT-087 | VariantAdded        |
| EVT-088 | InventoryUpdated    |
| EVT-089 | InventoryLow        |
| EVT-090 | InventoryReserved   |
| EVT-091 | InventoryReleased   |
| EVT-092 | VehiclePriceChanged |
| EVT-093 | VehicleSold         |

### 12.8 Workflow / Task (10)

| Code    | Event                 |
| ------- | --------------------- |
| EVT-094 | WorkflowStarted       |
| EVT-095 | WorkflowStepCompleted |
| EVT-096 | WorkflowPaused        |
| EVT-097 | WorkflowResumed       |
| EVT-098 | WorkflowFailed        |
| EVT-099 | WorkflowCompleted     |
| EVT-100 | TaskCreated           |
| EVT-101 | TaskAssigned          |
| EVT-102 | TaskCompleted         |
| EVT-103 | TaskEscalated         |

### 12.9 AI Runtime (10)

| Code    | Event                  |
| ------- | ---------------------- |
| EVT-104 | AgentInvoked           |
| EVT-105 | AgentPlanCreated       |
| EVT-106 | AgentActionExecuted    |
| EVT-107 | AgentFailed            |
| EVT-108 | AgentEscalated         |
| EVT-109 | ReflectionCompleted    |
| EVT-110 | ConfidenceLow          |
| EVT-111 | GuardrailTriggered     |
| EVT-112 | GuardrailApproved      |
| EVT-113 | ModelFallbackTriggered |

### 12.10 Knowledge / Learning (7)

| Code    | Event                  |
| ------- | ---------------------- |
| EVT-114 | KnowledgeIngested      |
| EVT-115 | KnowledgeUpdated       |
| EVT-116 | KnowledgeStale         |
| EVT-117 | LearningUpdated        |
| EVT-118 | PromptVersionPublished |
| EVT-119 | PromptRegressionFailed |
| EVT-120 | ModelPromoted          |

### 12.11 Notification (5)

| Code    | Event              |
| ------- | ------------------ |
| EVT-121 | NotificationQueued |
| EVT-122 | NotificationSent   |
| EVT-123 | NotificationFailed |
| EVT-124 | HotLeadNotified    |
| EVT-125 | AlertRaised        |

### 12.12 Identity / Billing (8)

| Code    | Event               |
| ------- | ------------------- |
| EVT-126 | TenantOnboarded     |
| EVT-127 | TenantSuspended     |
| EVT-128 | TenantPlanChanged   |
| EVT-129 | SubscriptionRenewed |
| EVT-130 | InvoiceGenerated    |
| EVT-131 | PaymentFailed       |
| EVT-132 | UserInvited         |
| EVT-133 | UserRoleChanged     |

### 12.13 Simulation (5)

| Code    | Event                |
| ------- | -------------------- |
| EVT-134 | SimulationRun        |
| EVT-135 | SimulationPassed     |
| EVT-136 | SimulationFailed     |
| EVT-137 | ScenarioAdded        |
| EVT-138 | CanaryReleaseStarted |

---

## 13. Commands (Catalog — 112 commands)

Naming follows imperative-verb-first form (Constitution §6 conventions extended in §26 below).

### 13.1 Marketing / Ads / Content (20)

CreateCampaign, PublishCampaign, PauseCampaign, ResumeCampaign, ArchiveCampaign, AllocateCampaignBudget, ChangeCampaignObjective, OptimizeCampaign, CreateAudience, GenerateAudienceSegment, CreateAds, PublishAds, PauseAds, ReallocateAdsBudget, SwapAdsCreative, RequestContent, GenerateContent, ApproveContent, RejectContent, PublishContent

### 13.2 Lead (16)

CreateLead, EnrichLead, DeduplicateLead, ScoreLead, QualifyLead, DisqualifyLead, RejectLead, MarkLeadHot, AssignLead, ReassignLead, ExpireLead, ReengageLead, ArchiveLead, MergeLead, ImportLead, TagLead

### 13.3 CRM / Conversation / Nurturing (16)

CreateCustomer, UpdateCustomerProfile, MergeCustomer, StartConversation, SendMessage, SendWhatsApp, SendEmail, SendSMS, StartNurturingSequence, AdvanceNurturingStep, ScheduleFollowUp, RecordCustomerOptOut, ReengageCustomer, UpdateCRM, LogActivity, RouteConversation

### 13.4 Sales Pipeline (20)

RequestAppointment, BookAppointment, ConfirmAppointment, RescheduleAppointment, CancelAppointment, RecordNoShow, ScheduleTestDrive, StartTestDrive, CompleteTestDrive, CancelTestDrive, GenerateQuotation, ReviseQuotation, ApproveQuotation, RejectQuotation, CreateSPK, ApproveSPK, CancelSPK, AllocateVehicle, ScheduleDelivery, ConfirmDelivery

### 13.5 Vehicle / Inventory (8)

RegisterVehicle, AddVariant, UpdateInventory, ReserveInventory, ReleaseInventory, ChangeVehiclePrice, MarkVehicleSold, SyncInventoryFeed

### 13.6 Workflow / Task (8)

StartWorkflow, PauseWorkflow, ResumeWorkflow, CancelWorkflow, CreateTask, AssignTask, CompleteTask, EscalateTask

### 13.7 AI Runtime (10)

InvokeAgent, CreatePlan, ExecuteAction, RunReflection, EscalateAgent, EvaluateGuardrail, ApproveGuardrail, TriggerModelFallback, RetryAgentAction, HaltAgent

### 13.8 Knowledge / Learning / Simulation (8)

IngestKnowledge, UpdateKnowledge, PublishPromptVersion, RunPromptRegression, PromoteModel, RunSimulation, AddScenario, StartCanaryRelease

### 13.9 Notification / Identity / Billing (6)

QueueNotification, SendNotification, NotifyHotLead, OnboardTenant, ChangeTenantPlan, GenerateInvoice

112 Commands total.

---

## 14. Queries (Catalog — 112 queries)

### 14.1 Lead / CRM (20)

FindHotLead, ListLeadsBySource, GetLeadScoreHistory, FindLeadByPhone, FindLeadByEmail, ListUnassignedLeads, GetLeadQualificationStatus, ListExpiringLeads, FindDuplicateLeads, GetCustomerProfile, ListCustomerConversations, GetConversationHistory, FindCustomersByLifecycleStage, ListOptedOutCustomers, GetNurturingSequenceStatus, ListLeadsByAssignee, GetLeadConversionRate, FindColdLeadsForReengagement, ListLeadActivities, GetLeadFunnelStage

### 14.2 Marketing / Ads / Content (18)

FindBestCampaign, GetCampaignROI, GetCampaignPerformance, ListActiveCampaigns, GetCampaignBudgetUtilization, ListAudienceSegments, GetAdsPerformance, ListUnderperformingAds, GetAdsSpendByPeriod, FindBestPerformingCreative, ListContentByStatus, GetContentApprovalQueue, GetContentPerformance, ListScheduledContent, GetCampaignAttribution, ListCampaignsByObjective, GetAudienceReach, GetCreativeVariantPerformance

### 14.3 Sales Pipeline (20)

ListUpcomingAppointments, GetAppointmentByCustomer, ListNoShowAppointments, GetTestDriveSchedule, ListCompletedTestDrives, GetQuotationByCustomer, ListPendingQuotations, GetQuotationHistory, ListActiveSPK, GetSPKStatus, ListDeliveriesScheduled, GetDeliveryStatus, GetSalesPerformance, GetSalesPipelineFunnel, ListSalesByBranch, GetConversionRateByStage, GetAverageDealCycleTime, ListOverdueQuotations, GetVehicleAllocationStatus, GetDeliveryBacklog

### 14.4 Vehicle / Inventory (10)

GetInventoryByBranch, ListLowStockVehicles, GetVehicleAvailability, FindVehicleByVariant, GetInventoryTurnoverRate, ListReservedInventory, GetVehiclePriceHistory, ListBestSellingVariants, GetInventoryAgingReport, FindAvailableVehicleForQuotation

### 14.5 Analytics / Dealer / KPI (18)

GetDealerPerformance, GetBranchPerformance, GetFunnelConversionReport, GetLeadSourceROI, GetMarketingSpendEfficiency, GetCostPerLead, GetCostPerHotLead, GetCustomerAcquisitionCost, GetSalesTargetAttainment, GetChannelPerformanceComparison, GetCohortRetentionReport, GetTenantUsageReport, GetAgentPerformanceReport, GetWorkflowSuccessRate, GetAverageResponseTime, GetGuardrailTriggerRate, GetModelCostReport, GetSimulationPassRate

### 14.6 AI Runtime / Knowledge / Workflow / Notification / Identity / Billing (26)

GetAgentDecisionLog, GetAgentConfidenceDistribution, ListEscalatedAgentActions, GetReflectionOutcomes, GetKnowledgeFreshness, FindRelevantKnowledge, GetPromptVersionHistory, GetActiveWorkflows, GetWorkflowStepStatus, ListFailedWorkflows, GetTaskQueueDepth, ListEscalatedTasks, GetNotificationDeliveryStatus, ListFailedNotifications, GetTenantConfiguration, ListTenantUsers, GetUserPermissions, GetRoleAssignments, GetSubscriptionStatus, GetInvoiceHistory, GetBillingUsageBreakdown, ListActiveScenarios, GetSimulationResults, GetCanaryReleaseStatus, GetModelRoutingRules, GetEventAuditTrail

112 Queries total.

---

## 15. Policies

Policies are reactive business rules of the form "when Event X occurs, if Condition, then Command Y is triggered." They are the connective tissue Event Storming makes visible.

| Policy                           | Trigger Event                   | Condition                           | Resulting Command                                             |
| -------------------------------- | ------------------------------- | ----------------------------------- | ------------------------------------------------------------- |
| Hot Lead Handoff Policy          | LeadScored                      | score ≥ tenant hot threshold        | MarkLeadHot → NotifyHotLead                                   |
| Auto-Nurture Policy              | LeadQualified                   | status = warm/cold                  | StartNurturingSequence                                        |
| Lead Expiry Policy               | (scheduled check)               | no activity for N days              | ExpireLead                                                    |
| Follow-Up Reminder Policy        | AppointmentBooked               | T-24h before appointment            | QueueNotification                                             |
| No-Show Recovery Policy          | AppointmentNoShow               | —                                   | ReengageCustomer                                              |
| Budget Ceiling Policy            | CampaignBudgetAllocated attempt | would exceed tenant ceiling         | EvaluateGuardrail (block)                                     |
| Campaign Auto-Pause Policy       | CampaignBudgetExhausted         | —                                   | PauseCampaign                                                 |
| Low-Confidence Escalation Policy | ReflectionCompleted             | confidence < threshold              | EscalateAgent                                                 |
| Guardrail Fail-Closed Policy     | GuardrailTriggered              | guardrail engine unreachable        | HaltAgent (defaults to human approval)                        |
| SPK Precondition Policy          | attempt CreateSPK               | TestDriveCompleted not present      | reject command (see BR §16)                                   |
| Inventory Reservation Policy     | QuotationApproved               | matching vehicle available          | ReserveInventory                                              |
| Knowledge Staleness Policy       | (scheduled check)               | knowledge exceeds max-staleness SLA | KnowledgeStale → alert Content/Knowledge owner                |
| Model Regression Gate Policy     | PromptVersionPublished          | RunPromptRegression fails           | block promotion, PromptRegressionFailed                       |
| Canary Gate Policy               | SimulationPassed                | —                                   | StartCanaryRelease                                            |
| Opt-Out Compliance Policy        | CustomerOptedOut                | —                                   | halt all further NurturingSequence commands for that customer |

---

## 16. Business Rules (Catalog — 112 rules)

### 16.1 Lead & Qualification (18)

- **BR-001** Lead is Hot if Lead Score ≥ 80 (tenant-configurable threshold).
- **BR-002** Lead is Warm if Lead Score is between 50 and 79 inclusive.
- **BR-003** Lead is Cold if Lead Score is below 50.
- **BR-004** Lead expires after 30 days of no activity (tenant-configurable).
- **BR-005** An expired Lead may be reengaged, restarting its lifecycle from Cold.
- **BR-006** A Lead must have at least one valid contact method (Phone or Email) to be created.
- **BR-007** Duplicate Leads (same Phone or Email within a tenant) must be merged, not duplicated.
- **BR-008** Lead Score must be recomputed on every qualifying interaction (reply, appointment, test drive).
- **BR-009** A Lead cannot be assigned to Sales staff outside its Branch's region unless explicitly reassigned by a Manager.
- **BR-010** A Disqualified Lead cannot re-enter the Hot Lead notification flow without a Manager override.
- **BR-011** Lead source must be recorded and immutable once set.
- **BR-012** A Lead opted out of communication (CustomerOptedOut) must not receive further automated nurturing.
- **BR-013** Only one active Nurturing Sequence may run per Lead at a time.
- **BR-014** A Lead's assignment to a specific Sales staff member must be logged as an Activity for audit.
- **BR-015** Lead deduplication must run before a new Lead is persisted, not after.
- **BR-016** A Lead's qualification decision must record the contributing Agent, model, and confidence score.
- **BR-017** Low-confidence qualification decisions (confidence < tenant threshold) must escalate to human review rather than auto-qualify.
- **BR-018** A Hot Lead notification must include the Lead's reasoning trace, not just contact details.

### 16.2 Campaign & Ads (16)

- **BR-019** A Campaign cannot be Published if its Budget = 0.
- **BR-020** A Campaign's total allocated budget cannot exceed the tenant's period budget ceiling.
- **BR-021** A Campaign must have exactly one Objective at any time.
- **BR-022** A Campaign's DateRange start must be before or equal to its end.
- **BR-023** An Ads entity cannot be Published without an approved Creative.
- **BR-024** Ads spend increases above a tenant-configured percentage require Guardrail approval before execution.
- **BR-025** A Campaign auto-pauses when its budget is exhausted.
- **BR-026** A Campaign cannot be reactivated after Archived; a new Campaign must be created.
- **BR-027** Audience segments must be recomputed if underlying segment criteria change.
- **BR-028** Ads with CTR dropping below a tenant threshold for N consecutive days trigger a CampaignOptimized review.
- **BR-029** Budget reallocation across Ads within a Campaign cannot exceed the Campaign's total budget.
- **BR-030** A Campaign's Objective determines which optimization metric CampaignOptimizationService targets.
- **BR-031** Content must be Approved before it can be used as an Ads Creative.
- **BR-032** A Campaign targeting a specific Branch's Audience must respect that Branch's working region.
- **BR-033** Campaign spend must be recorded per transaction, not batched, for real-time budget ceiling enforcement.
- **BR-034** A paused Campaign's scheduled Content must also pause, not continue publishing.

### 16.3 Content (8)

- **BR-035** Generated Content must pass brand-safety Guardrail check before reaching Approved status.
- **BR-036** Content cannot be Published before its scheduled publish time.
- **BR-037** Rejected Content requires a rejection reason recorded for Agent learning feedback.
- **BR-038** A Creative must reference valid, current Vehicle/Variant data if it depicts inventory.
- **BR-039** Content performance score must be computed no earlier than 24 hours post-publish to allow meaningful signal.
- **BR-040** Archived Content cannot be reused without re-approval.
- **BR-041** Content generation requests must specify a target Campaign or stand-alone purpose; orphaned Content is not permitted.
- **BR-042** Multiple Creative variants for the same Content must be evaluated for performance before one is selected as primary.

### 16.4 Sales Pipeline: Appointment / Test Drive / Quotation / SPK / Delivery (26)

- **BR-043** An Appointment cannot be Booked outside the Branch's Working Hour.
- **BR-044** An Appointment requires either a Lead or existing Customer reference — never neither.
- **BR-045** A Test Drive can only be Scheduled against a Confirmed Appointment.
- **BR-046** A Test Drive cannot Start without an available, non-reserved Vehicle.
- **BR-047** SPK can only be created if Test Drive is Completed (unless the tenant has explicitly waived this policy for a product line).
- **BR-048** A Quotation must reference at least one Vehicle/Variant with a valid current price.
- **BR-049** A Quotation is automatically Expired after its tenant-configured validity window (default 14 days).
- **BR-050** A Quotation cannot be Approved if the underlying Vehicle/Variant price has changed since creation without revision.
- **BR-051** SPK requires an Approved Quotation as precondition.
- **BR-052** SPK cannot be Approved without confirmed Vehicle allocation.
- **BR-053** SPK cancellation after Vehicle allocation must trigger InventoryReleased.
- **BR-054** Delivery cannot be Confirmed without an Approved SPK.
- **BR-055** Delivery date cannot be set before the SPK approval date.
- **BR-056** A Vehicle cannot be Delivered if still marked Reserved for a different SPK.
- **BR-057** VehicleSold status is only set upon confirmed Delivery, not upon SPK creation.
- **BR-058** An Appointment No-Show must trigger a re-engagement Nurturing step, not immediate Lead disqualification.
- **BR-059** Appointment rescheduling more than N times (tenant-configurable) flags the Lead for Manager review.
- **BR-060** Only Sales staff assigned to the Lead/Customer may create a Quotation for them, unless a Manager override applies.
- **BR-061** A Quotation's Money value lines must sum consistently to its stated total (no silent rounding drift).
- **BR-062** SPK requires explicit Customer signature/confirmation recorded before status = Approved.
- **BR-063** A cancelled Appointment must release any tentatively held Test Drive vehicle slot.
- **BR-064** Delivery completion must update the Customer lifecycle stage to "Owner."
- **BR-065** Post-delivery, the Customer enters the Retention phase and exits active Sales pipeline tracking.
- **BR-066** An Appointment, Test Drive, Quotation, or SPK must always be traceable back to its originating Lead for attribution.
- **BR-067** SPK cannot be edited after Approved; corrections require a new SPK referencing the cancelled one.
- **BR-068** Delivery scheduling must check Branch logistics capacity before confirming a date.

### 16.5 Vehicle & Inventory (8)

- **BR-069** Inventory quantity cannot go negative.
- **BR-070** A Vehicle price change does not retroactively affect already-Approved Quotations.
- **BR-071** InventoryReserved must have a corresponding SPK or active Quotation reference; orphan reservations auto-release after a timeout.
- **BR-072** Inventory low-stock threshold triggers an InventoryLow event, not an automatic reorder (human/ERP-system decision).
- **BR-073** A Variant cannot be added to a Vehicle without a valid Brand and Model reference.
- **BR-074** Inventory sync from external feeds must reconcile, not blindly overwrite, active reservations.
- **BR-075** VehicleSold vehicles are excluded from availability queries automatically.
- **BR-076** Inventory data older than its freshness SLA must be flagged before being used in a customer-facing Quotation.

### 16.6 Workflow / AI Runtime / Guardrail (20)

- **BR-077** A Workflow step with an irreversible side effect must have a defined compensation action before it can be published Active in the Workflow Registry.
- **BR-078** A Workflow cannot exceed its declared maximum execution time without triggering an alert.
- **BR-079** A Workflow cannot exceed its declared cost budget without halting further spend-capable steps.
- **BR-080** An Agent cannot invoke a Tool not in its declared permission list.
- **BR-081** An Agent's spend-capable action must pass Guardrail approval before Tool execution.
- **BR-082** If the Guardrail Engine is unreachable, the default outcome is human-approval-required, never auto-approval.
- **BR-083** An Agent's confidence score below the tenant-configured threshold forces escalation, never silent auto-completion.
- **BR-084** A Task assigned to an Agent that fails N consecutive times must escalate to a human Task.
- **BR-085** Every Agent action must be linked to the Workflow step (if any) that triggered it, for traceability.
- **BR-086** A Workflow paused by a tenant admin must not resume automatically without explicit tenant action.
- **BR-087** Prompt version changes require passing PromptRegression tests before promotion to Active in the Prompt Registry.
- **BR-088** A new Agent/prompt/model version must pass Simulation before any live tenant traffic is routed to it.
- **BR-089** Canary release must be limited to an explicitly opted-in tenant subset before global rollout.
- **BR-090** Model fallback must occur transparently without requiring Workflow-level intervention.
- **BR-091** An Agent must never call another Agent directly; coordination is via Event Bus only.
- **BR-092** Every Agent decision affecting a customer or spend must be logged with sufficient context to reconstruct the decision.
- **BR-093** A retried Agent action must use an idempotency key to prevent duplicate side effects.
- **BR-094** Knowledge older than its max-staleness SLA must not be used for customer-facing pricing/inventory claims.
- **BR-095** A Guardrail rejection must be logged with the specific policy rule that triggered it.
- **BR-096** Agent cost ceilings must be configured before the Agent is enabled for any tenant.

### 16.7 Tenant, Identity & Billing (10)

- **BR-097** A Tenant cannot access another Tenant's data under any circumstance, enforced at the storage layer.
- **BR-098** A User can only be assigned Roles valid within their own Tenant.
- **BR-099** A Tenant's Subscription must be Active for autonomous Agent actions to execute; a Suspended Tenant's Agents halt.
- **BR-100** A Dealer with multiple Branches shares one Tenant but Branch-scoped data (Appointments, Inventory) remains Branch-isolated for reporting.
- **BR-101** Invoice generation must reflect metered usage (Agent calls, messages sent) accurately per Constitution §23.3 cost tracking.
- **BR-102** A failed Payment triggers a grace period before Subscription Suspension, never immediate service cutoff.
- **BR-103** Tenant plan downgrades cannot silently disable in-flight Workflows; they must complete or be explicitly halted.
- **BR-104** User invitations expire after a configurable window if not accepted.
- **BR-105** Role permission changes take effect immediately for new requests but do not retroactively alter already-authorized in-flight actions.

### 16.8 Cross-Cutting (7)

- **BR-106** Every Domain Event must carry a Trace ID propagated from its originating request/workflow.
- **BR-107** Every Aggregate mutation must be attributable to an actor (Human User or Agent) for audit.
- **BR-108** PII fields (Phone, Email, Address) must be tagged for redaction and retention policy at the field level.
- **BR-109** A Customer's right-to-erasure request must cascade to Lead, Conversation, and Memory records referencing them.
- **BR-110** Business rules encoded here must be enforced at the domain/application layer, never trusted to UI-layer validation alone.
- **BR-111** Any Business Rule change affecting an active Aggregate's invariants requires a migration/versioning plan, not a silent behavior change.
- **BR-112** Where this catalog and a future feature request conflict, this catalog is presumed correct until formally amended via ADR, per Constitution §0.2/§115.

---

## 17. State Machine

### 17.1 Lead

```
 [New] ──enrich──▶ [Enriched] ──score──▶ [Scored] ──┬─▶ [Hot] ──assign──▶ [Assigned] ──▶ [Converted]
                                                     ├─▶ [Warm] ──nurture──▶ [Scored] (loop)
                                                     └─▶ [Cold] ──nurture──▶ [Scored] (loop)
 [Scored] ──no activity 30d──▶ [Expired] ──reengage──▶ [Enriched]
 [any] ──disqualify──▶ [Disqualified] ──▶ [Archived]
```

### 17.2 Campaign

```
[Draft] ──publish(budget>0)──▶ [Published] ──start──▶ [Running]
[Running] ──pause──▶ [Paused] ──resume──▶ [Running]
[Running] ──budget exhausted──▶ [Paused]
[Running]/[Paused] ──complete──▶ [Completed] ──▶ [Archived]
```

### 17.3 Workflow

```
[Created] ──start──▶ [Running] ──step ok (loop)──▶ [Running]
[Running] ──pause──▶ [Paused] ──resume──▶ [Running]
[Running] ──step fails, no compensation left──▶ [Failed]
[Running] ──all steps complete──▶ [Completed]
[Failed] ──compensation executed──▶ [Compensated]
```

### 17.4 Task

```
[Created] ──assign──▶ [Assigned] ──start──▶ [InProgress]
[InProgress] ──complete──▶ [Completed]
[InProgress] ──fail (N retries exhausted)──▶ [Escalated] ──human takes over──▶ [InProgress]
```

### 17.5 Agent (runtime instance)

```
[Invoked] ──plan──▶ [Planning] ──plan ready──▶ [Executing]
[Executing] ──guardrail reject──▶ [Escalated]
[Executing] ──action(s) done──▶ [Reflecting]
[Reflecting] ──confidence ≥ threshold──▶ [Completed]
[Reflecting] ──confidence < threshold──▶ [Escalated]
[any] ──unrecoverable error──▶ [Failed]
```

### 17.6 Appointment

```
[Requested] ──book (within working hour)──▶ [Booked] ──confirm──▶ [Confirmed]
[Confirmed] ──reschedule──▶ [Booked]
[Confirmed] ──cancel──▶ [Cancelled]
[Confirmed] ──date passes, no check-in──▶ [NoShow]
[Confirmed] ──customer arrives──▶ [Completed]
```

### 17.7 SPK

```
[Draft] ──create (Quotation Approved + TestDrive Completed)──▶ [PendingApproval]
[PendingApproval] ──customer signs──▶ [Approved]
[PendingApproval] ──cancel──▶ [Cancelled]
[Approved] ──vehicle delivered──▶ [Fulfilled]
[Approved] ──cancel (releases inventory)──▶ [Cancelled]
```

### 17.8 Customer (lifecycle stage)

```
[Lead] ──qualifying interaction──▶ [Prospect] ──SPK approved──▶ [Buyer]
[Buyer] ──delivery confirmed──▶ [Owner] ──retention nurturing──▶ [Advocate] / [Churned]
```

### 17.9 Content

```
[Requested] ──generate──▶ [Generated] ──guardrail check──▶ [PendingApproval]
[PendingApproval] ──approve──▶ [Approved] ──schedule──▶ [Scheduled] ──publish time reached──▶ [Published]
[PendingApproval] ──reject──▶ [Rejected] ──regenerate──▶ [Requested]
[Published] ──retire──▶ [Archived]
```

### 17.10 Ads

```
[Draft] ──publish (creative approved)──▶ [Published] ──▶ [Active]
[Active] ──pause──▶ [Paused] ──resume──▶ [Active]
[Active] ──performance evaluated, underperforming──▶ [Optimizing] ──▶ [Active]
[Active]/[Paused] ──campaign ends──▶ [Ended]
```

---

## 18. Lifecycle

Every Aggregate follows the same generic lifecycle envelope, specialized per its State Machine (§17):

```
Creation ──▶ Active Management (state transitions) ──▶ Terminal State (Completed/Archived/Cancelled)
    │
    └──▶ every transition emits a Domain Event, logged with actor + trace_id (BR-106, BR-107)
```

- **Creation** always validates required fields and Business Rules (§16) before persisting (e.g., a Lead cannot be created without Phone or Email — BR-006).
- **Active Management** is where most Business Rules and Policies apply, gating transitions.
- **Terminal State** is not deletion — Aggregates are retained per tenant retention policy (Constitution RULE-065) and remain queryable for Analytics/audit, with PII-bearing fields subject to erasure workflows independent of the Aggregate's lifecycle status.

---

## 19. Event Storming

Full end-to-end big-picture timeline (left to right = time; below each phase are the key Events, and the Policies bridging phases per §15):

```
 MARKETING          LEAD               QUALIFICATION        NURTURING           APPOINTMENT
 ──────────         ──────────         ──────────────       ──────────          ──────────────
 CampaignCreated     LeadCreated         LeadScored           NurturingSequence   AppointmentRequested
 CampaignPublished   LeadEnriched        LeadQualified        Started             AppointmentBooked
 AdsPublished        LeadDeduplicated    LeadHot ────────▶   NurturingStep       AppointmentConfirmed
 ContentPublished                        LeadWarm/Cold        Completed           AppointmentNoShow
                                          LeadAssigned         FollowUpScheduled
        │                   │                   │                   │                    │
        ▼                   ▼                   ▼                   ▼                    ▼
   [Policy: budget      [Policy: dedupe    [Policy: Hot Lead   [Policy: auto-      [Policy: reminder
    ceiling gate]        before create]     Handoff → notify]   nurture warm/cold]   T-24h; no-show →
                                                                                     reengage]

 TEST DRIVE          QUOTATION           SPK                 DELIVERY            RETENTION
 ──────────          ──────────          ──────────          ──────────          ──────────
 TestDriveScheduled  QuotationCreated    SPKCreated          VehicleAllocated    (Customer lifecycle
 TestDriveStarted    QuotationRevised    SPKApproved         VehicleDelivered     stage = Owner)
 TestDriveCompleted  QuotationApproved   SPKCancelled                            NurturingSequence
                     QuotationExpired                                            (post-sale, upsell/
                                                                                   service reminders)
        │                   │                   │                   │                    │
        ▼                   ▼                   ▼                   ▼                    ▼
  [Policy: SPK        [Policy: inventory  [Policy: signature   [Policy: lifecycle  [Policy: retention
   precondition =      reservation on      required before      stage → Owner on    nurturing sequence
   TestDrive done]      approval]           Approved]            confirmed]          triggered]
```

**Hot Spots (identified friction points requiring explicit design attention):**

- **Qualification → Appointment gap:** a Hot Lead not contacted within SLA needs an automatic re-escalation Policy (see BR-018, EVT-124 HotLeadNotified must be monitored, not fire-and-forget).
- **Test Drive → SPK precondition (BR-047):** tenant may need to waive this for certain product lines (e.g., pre-order-only models) — modeled as a per-tenant Policy exception, not a code branch.
- **Guardrail unavailability during Quotation/SPK spend-adjacent steps:** fail-closed per BR-082/ADR-016 in doc 002.

---

## 20. ER Diagram

```
 Tenant (1)───(N) Branch (1)───(N) Inventory (N)───(1) Vehicle (1)───(N) Variant
    │                │
    │                └───(N) Appointment (N)───(1) Customer (1)───(N) Conversation
    │                        │                        │
    │                        │                        └───(N) Lead (N)───(1) Campaign
    │                        │                                             │
    │                        └───(0..1) TestDrive                          └───(N) Ads
    │                                    │                                  │
    │                                    └───(0..1) Quotation (1)───(N) SPK └───(N) Content
    │                                                          │
    │                                                          └───(0..1) Delivery
    │
    └───(N) User (N)───(N) Role

 Workflow (1)───(N) Task (N)───(0..1) Agent (N)───(N) Tool
    │
    └───(N) Event  (all Aggregates emit into this stream)

 Subscription (1)───(1) Tenant
 Subscription (1)───(N) Invoice
```

Cardinalities are illustrative of the dominant relationships; a Lead may exist without a Customer (pre-conversion) — the Customer relationship is established only after a qualifying interaction, matching the Ubiquitous Language definition in §5.

---

## 21. Aggregate Relationship

```
Campaign ──targets──▶ Audience
Campaign ──produces──▶ Ads, Content
Ads/Content ──generates──▶ Lead (via inbound engagement)
Lead ──converts to──▶ Customer (on qualifying interaction)
Customer ──initiates──▶ Appointment ──leads to──▶ TestDrive ──leads to──▶ Quotation ──leads to──▶ SPK ──leads to──▶ Delivery
Workflow ──orchestrates──▶ (any of the above, via Tasks calling Domain Services/Tools)
Agent ──acts within──▶ Workflow steps, gated by Guardrail
Tenant ──scopes──▶ every Aggregate above
```

Each arrow is a reference-by-ID relationship (never embedding), consistent with §8's Aggregate design rule.

---

## 22. Domain Dependency

```
Identity ──▶ (everything; every Aggregate needs a resolved Tenant)
Marketing ──▶ Content, Ads
Lead ──▶ Marketing (source attribution), CRM (assignment target)
CRM ──▶ Lead, Sales (pipeline progression)
Sales ──▶ CRM, Vehicle/Inventory
AI Runtime ──▶ Knowledge, all Core Domain contexts (as the executor of their automation)
Workflow ──▶ AI Runtime, Sales, Marketing, CRM (as the orchestrator)
Analytics ──▶ (read-only, event-sourced from all contexts)
Notification ──▶ (read-only trigger from all contexts)
Billing ──▶ Identity
Simulation ──▶ AI Runtime, Knowledge (read-only, sandboxed)
```

This is a directed graph, not strictly layered — Domain Dependency direction determines which context's Registry/Policy changes require downstream review (e.g., a Lead scoring rule change should be reviewed against CRM's assignment Policy).

---

## 23. Data Ownership

| Context      | Owns (writes)                                                      | Reads (via event/API, never direct write)                                |
| ------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Marketing    | Campaign, Audience                                                 | Lead source stats (Analytics)                                            |
| Ads          | Ads                                                                | Campaign (reference only)                                                |
| Content      | Content, Creative                                                  | Campaign, Vehicle (for accurate depiction)                               |
| Lead         | Lead                                                               | Customer merge target (CRM)                                              |
| CRM          | Customer, Conversation                                             | Lead (reference), Sales pipeline status                                  |
| Sales        | Appointment, Quotation, SPK, Delivery, Vehicle, Variant, Inventory | Customer (reference)                                                     |
| Workflow     | Workflow, Task                                                     | All contexts it orchestrates (via Tool/Agent calls, never direct writes) |
| AI Runtime   | Agent (runtime record), Memory                                     | Knowledge, Registry entries                                              |
| Knowledge    | Knowledge                                                          | Vehicle/Inventory (source feed)                                          |
| Analytics    | Analytics Warehouse (derived)                                      | All contexts, event-sourced only                                         |
| Notification | Notification                                                       | Trigger events from all contexts                                         |
| Identity     | Tenant, Branch, User, Role                                         | —                                                                        |
| Billing      | Subscription, Invoice, Plan                                        | Identity (tenant/plan reference via ACL)                                 |
| Simulation   | Scenario, run history                                              | AI Runtime/Knowledge (read-only sandbox)                                 |

No context ever writes into another context's owned data (Constitution RULE-027).

---

## 24. Permission Matrix

Legend: **C**=Create, **R**=Read, **U**=Update, **A**=Approve/Execute-irreversible, **X**=Explicitly Denied

| Capability / Aggregate         | CEO AI | COO AI | Marketing AI               | Sales AI | Dealer (Admin) | Sales (staff) | Admin (ops) | Manager |
| ------------------------------ | ------ | ------ | -------------------------- | -------- | -------------- | ------------- | ----------- | ------- |
| Campaign (create/publish)      | R      | R      | CRUA                       | R        | CRUA           | R             | R           | R       |
| Ads spend adjustment           | R      | R      | CRU (A gated by Guardrail) | X        | A              | X             | R           | A       |
| Content generation/approval    | R      | R      | CRUA                       | R        | CRUA           | R             | R           | R       |
| Lead scoring/qualification     | R      | R      | R                          | CRUA     | R              | R             | R           | R       |
| Lead assignment                | R      | R      | R                          | CRUA     | CRU            | R (own)       | R           | CRU     |
| Appointment                    | R      | R      | X                          | CRU      | CRU            | CRU (own)     | R           | CRU     |
| Test Drive                     | R      | R      | X                          | R        | R              | CRU (own)     | R           | R       |
| Quotation                      | R      | R      | X                          | R        | R              | CRU (own)     | R           | A       |
| SPK                            | R      | R      | X                          | R        | R              | CR (own)      | R           | A       |
| Delivery                       | R      | R      | X                          | R        | R              | CU (own)      | R           | A       |
| Vehicle/Inventory              | R      | R      | R                          | R        | CRU            | R             | CRU         | CRU     |
| Tenant configuration           | R      | R      | X                          | X        | CRU            | X             | R           | X       |
| Billing/Subscription           | R      | R      | X                          | X        | R              | X             | CRUA        | X       |
| User/Role management           | R      | R      | X                          | X        | CRUA           | X             | CRU         | R       |
| Agent/Workflow enable-disable  | A      | A      | R                          | R        | A (own tenant) | X             | R           | X       |
| Guardrail policy configuration | A      | A      | X                          | X        | R              | X             | R           | X       |

**Notes:**

- "AI" rows (CEO AI, COO AI, Marketing AI, Sales AI) represent autonomous Agent permission classes, enforced by the Tool Manager's permission check (Constitution RULE-009) — not by trusting the Agent's own judgment.
- CEO AI / COO AI are cross-context strategic Agents with read visibility everywhere but write access only to Agent/Workflow/Guardrail governance — they do not directly execute Sales pipeline transactions.
- "Dealer (Admin)" is the tenant owner role; "Manager" and "Sales" are Branch-scoped human roles; "Admin (ops)" is AOS's own internal operations role, distinct from the Dealer's Admin, and is bound by Constitution RULE-066 (audited break-glass access).

---

## 25. Tenant Isolation

Per Constitution §12 and Architecture §12, tenant isolation is enforced at the storage layer, not application logic alone. This section defines the domain-level isolation strategy.

| Strategy                                | When Used                                                                | Trade Off                                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| **Shared Database, Row-Level Security** | Default tier — all Aggregates carry `tenant_id`, enforced via RLS policy | Lowest cost, fastest onboarding; requires rigorous, centrally-templated RLS policy per table to avoid misconfiguration risk |
| **Schema per Tenant**                   | Mid-tier dealers with moderate compliance needs                          | Stronger logical isolation than RLS alone; more migration overhead (N schemas to migrate per release)                       |
| **Database per Tenant**                 | Enterprise/Tier-1 dealers, or tenants with data-residency requirements   | Strongest isolation and easiest per-tenant backup/restore/DR; highest operational cost, used selectively                    |

**Domain-level isolation rules:**

- Every Aggregate Root listed in §8 carries `tenant_id` as a mandatory, immutable field set at creation.
- Cross-tenant references are structurally impossible: a Lead's `campaignId` can only resolve to a Campaign within the same `tenant_id` — enforced by a composite lookup key, never a bare foreign key.
- Branch-level sub-isolation (BR-100) is a second, nested scoping dimension within a Tenant for Dealers with multiple Branches — used for reporting and Working Hour/region rules, not a separate storage isolation tier.
- Memory (Working/Episodic/Semantic, per doc 002 §20) and Knowledge are tenant-scoped identically to transactional Aggregates.
- Analytics Warehouse partitions by `tenant_id` at the storage layer even though it is event-sourced and read-optimized (doc 002 §22, ADR-017).

---

## 26. Naming Convention

Extends Constitution §6 with domain-specific rules:

- **Domain Events** — `<Entity><PastTenseVerb>` in PascalCase for the catalog name (§12), serialized on the Event Bus as `<domain>.<entity>_<past_tense_verb>` snake_case per Constitution RULE §6.4 (e.g., `LeadHot` → `lead.hot`, `SPKCreated` → `sales.spk_created`).
- **Commands** — `<VerbFirst><Entity>` PascalCase, imperative mood (e.g., `CreateSPK`, `AssignLead`) — never past tense, to visually distinguish from Events.
- **Queries** — `<Find|Get|List><Criteria><Entity>` PascalCase (e.g., `FindHotLead`, `GetDealerPerformance`, `ListUpcomingAppointments`); `Find` implies a single/best match, `List` implies a collection, `Get` implies a direct-key lookup.
- **Aggregates/Entities** — singular noun, PascalCase (`Lead`, not `Leads`); persisted table names are plural snake_case per Constitution §6.7 (`leads`).
- **Value Objects** — singular noun or noun phrase, PascalCase, always immutable (`LeadScore`, `CampaignBudget`).
- **Business Rules** — `BR-###`, permanent numbering, never reused, mirroring Constitution's `RULE-###` discipline (§0.4).
- **Domain Events/Commands/Queries codes** — `EVT-###` / `CMD-###` (implicit by catalog order) / `QRY-###` (implicit by catalog order) used only for cross-referencing in documentation, never as the runtime identifier.
- **Policies** — named as `<Trigger/Purpose> Policy` (e.g., "Hot Lead Handoff Policy"), stored in the Policy Registry (Constitution §9) keyed by a machine-readable slug.

---

## 27. Validation Rules

Representative field-level validation for the highest-risk Aggregates (full schema-level validation is defined at implementation time against the Tool/API schemas per Constitution RULE-005 Coding Standards, but the domain-level constraints are fixed here):

| Aggregate                              | Field                           | Validation                                                                                                                               |
| -------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Lead                                   | phone or email                  | at least one must be present and valid (BR-006)                                                                                          |
| Lead                                   | score                           | 0–100 integer                                                                                                                            |
| Customer                               | email                           | RFC 5322-valid format                                                                                                                    |
| Customer                               | phone                           | E.164-normalized                                                                                                                         |
| Campaign                               | budget.amount                   | > 0 to Publish (BR-019)                                                                                                                  |
| Campaign                               | dateRange                       | start ≤ end (BR-022)                                                                                                                     |
| Quotation                              | priceLines                      | sum of lines = stated total (BR-061)                                                                                                     |
| Quotation                              | validUntil                      | createdAt + tenant validity window (default 14 days, BR-049)                                                                             |
| SPK                                    | precondition                    | referenced Quotation.status = Approved AND referenced TestDrive.status = Completed (BR-047, BR-051), unless tenant waiver Policy applies |
| Appointment                            | dateTime                        | within referenced Branch's WorkingHour (BR-043)                                                                                          |
| Inventory                              | quantity                        | ≥ 0 at all times (BR-069)                                                                                                                |
| Agent                                  | costCeiling                     | must be set (non-null) before Agent is enabled for any tenant (BR-096)                                                                   |
| Workflow                               | maxExecutionTime, maxCostBudget | both required, non-null, before Workflow Registry publish to Active                                                                      |
| All PII fields (phone, email, address) | —                               | must be tagged `pii: true` in schema for redaction/retention enforcement (BR-108)                                                        |

---

## 28. KPI Definition

| Domain   | KPI                            | Definition                                                                               |
| -------- | ------------------------------ | ---------------------------------------------------------------------------------------- |
| Dealer   | Overall Funnel Conversion Rate | Delivered / LeadCreated over period                                                      |
| Dealer   | Time-to-Hot-Lead               | Median time from LeadCreated to LeadHot                                                  |
| Dealer   | Revenue per Tenant             | Sum of Delivery-linked Quotation value per period                                        |
| Sales    | Sales Performance Score        | Weighted (Appointments kept, Quotations converted, Deliveries completed) per Sales staff |
| Sales    | Average Deal Cycle Time        | Median time from AppointmentBooked to VehicleDelivered                                   |
| Sales    | No-Show Rate                   | AppointmentNoShow / AppointmentBooked                                                    |
| Campaign | Campaign ROI                   | (Attributed Delivery Revenue − Campaign Spend) / Campaign Spend                          |
| Campaign | Cost per Lead (CPL)            | Campaign Spend / LeadCreated attributed                                                  |
| Campaign | Cost per Hot Lead (CPHL)       | Campaign Spend / LeadHot attributed                                                      |
| Ads      | Click-Through Rate (CTR)       | Clicks / Impressions                                                                     |
| Ads      | Ads Spend Efficiency           | Attributed Conversions / Ads Spend                                                       |
| Content  | Content Engagement Rate        | Engagements / Impressions per Content                                                    |
| Content  | Content Approval Rate          | ContentApproved / ContentGenerated                                                       |
| AI Agent | Agent Success Rate             | AgentActionExecuted successfully / AgentInvoked                                          |
| AI Agent | Agent Escalation Rate          | AgentEscalated / AgentInvoked                                                            |
| AI Agent | Average Confidence Score       | Mean confidence across ReflectionCompleted events                                        |
| AI Agent | Cost per Agent Decision        | Total Model Router cost / AgentInvoked count                                             |
| Workflow | Workflow Success Rate          | WorkflowCompleted / WorkflowStarted                                                      |
| Workflow | Average Workflow Duration      | Mean time from WorkflowStarted to WorkflowCompleted                                      |
| Workflow | SLA Breach Rate                | Workflows exceeding declared maxExecutionTime / total                                    |

---

## 29. Reporting Model

Reports are derived exclusively from the Analytics Warehouse (event-sourced, per doc 002 §22 and ADR-017), never from direct transactional reads, keeping reporting fully decoupled from operational load.

```
Domain Events ──▶ Event Bus ──▶ Analytics Warehouse (ingestion)
                                        │
                                        ▼
                              Aggregation/Rollup Jobs (Scheduler-driven)
                                        │
                                        ▼
                                Metrics Semantic Layer (KPI definitions, §28, defined once)
                                        │
                          ┌─────────────┼─────────────┐
                          ▼             ▼             ▼
                  Dealer Dashboard  Sales Console  CampaignAgent
                  (funnel, KPI)     (pipeline,     (optimization
                                     Hot Leads)      input features)
```

**Report catalog (representative, derived from Queries in §14):** Dealer Performance Report, Branch Performance Report, Funnel Conversion Report, Campaign ROI Report, Sales Performance Report, Agent Performance Report, Workflow Health Report, Tenant Usage/Billing Report — each backed by one or more KPI definitions from §28 and one or more Queries from §14, never computed ad hoc per report to avoid metric drift (Architecture §22 Best Practice).

---

## 30. Future Extension

The domain model anticipates, without requiring rework:

- **Finance & Insurance (F&I) Context** — new Bounded Context for financing/insurance attachment, plugging into the existing SPK Aggregate via a new reference field, not a schema rewrite.
- **Service/Aftersales Context** — extends the Customer lifecycle (§17.8 Owner → Advocate) with a new Bounded Context for service bookings, reusing the Appointment Aggregate pattern.
- **Trade-In Context** — a new Aggregate feeding into Quotation as an additional price line source.
- **Multi-Brand Dealer Groups** — Tenant → Branch already supports multiple Branches per Tenant; multi-brand simply adds a Brand dimension to Vehicle without touching Tenant/Branch structure.
- **Marketplace/Third-Party Lead Sources** — new Lead `source` values only; no Aggregate change (BR-011 already treats source as an immutable but open-ended field).
- **Voice Channel** — Conversation Aggregate's `channel` field already anticipates non-text channels; no structural change needed, only a new Notification/Tool Adapter (per doc 002 §29).

Any of the above that appears to require bypassing a Bounded Context boundary or an existing Aggregate invariant must go through the Constitution's Conflict Protocol (§0.2) before implementation.

---

## 31. Volume 004 — Core Runtime File List (Not Implemented)

The following is the file list to be created in Volume 004 (Core Runtime implementation planning/scaffolding). **None of these files are implemented in this document or this phase** — this is a forward-looking manifest only, derived from Architecture doc 002 §5.2 (Containers), §37 (Folder Structure), and this document's Aggregates/Domain Services.

```
docs/004-CORE-RUNTIME-SPECIFICATION.md        # Master spec for Volume 004

core/runtime/event-bus/
  README.md                                    # Responsibility, schema registry contract
  event-schema.spec.md                         # Canonical schema for all 138 events in §12

core/runtime/queue/
  README.md
  queue-contract.spec.md                       # Job envelope, DLQ, fair-share contract

core/runtime/scheduler/
  README.md
  scheduler-job.spec.md                        # Job manifest schema, tenant timezone handling

core/runtime/tool-manager/
  README.md
  tool-manifest.schema.md                      # Tool manifest fields, permission model

core/runtime/workflow-runtime/
  README.md
  workflow-definition.schema.md                # Declarative workflow step schema
  saga-compensation.spec.md

core/runtime/agent-runtime/
  README.md
  planner.spec.md
  executor.spec.md
  reflection-engine.spec.md

core/runtime/model-router/
  README.md
  routing-rules.schema.md
  fallback-chain.spec.md

core/runtime/memory-service/
  README.md
  memory-tiers.spec.md                          # Working/Episodic/Semantic contract

core/runtime/guardrail-engine/
  README.md
  policy-evaluation.spec.md
  fail-closed-behavior.spec.md

core/registry/
  prompt-registry/README.md
  workflow-registry/README.md
  tool-registry/README.md
  agent-registry/README.md
  model-registry/README.md
  policy-registry/README.md
  registry-versioning.spec.md

core/gateway/
  README.md
  tenant-resolution.spec.md
  rate-limiting.spec.md

shared/
  logging/README.md
  tracing/README.md
  error-types/README.md
  validation/README.md
  observability-sdk/README.md

infra/iac/README.md                             # IaC scaffolding plan (not applied)

tests/
  contract/README.md
  integration/README.md
  chaos/README.md
  isolation/README.md                           # Multi-tenant isolation test plan
```

**Next step after Volume 004 file list approval:** draft `docs/004-CORE-RUNTIME-SPECIFICATION.md` detailing each runtime pillar's interface contract (still design-only, no code), before any implementation prompt is issued.
