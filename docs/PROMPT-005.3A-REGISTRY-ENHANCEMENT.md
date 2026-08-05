# PROMPT 005.3A — Registry Enhancement (archived source prompt)

> Archived verbatim (translated structure preserved) before implementation, per the
> established pattern for every numbered Engineering Task prompt in this repository.

## Role

Principal Platform Architect + Distinguished Software Engineer developing AOS.

**INI BUKAN IMPLEMENTASI BARU. INI ADALAH ENHANCEMENT TERHADAP ENGINEERING TASK 005.3
REGISTRY SYSTEM YANG SUDAH SELESAI.**

## Wajib Membaca

- docs/001-ENGINEERING-CONSTITUTION.md
- docs/002-ENTERPRISE-ARCHITECTURE-BLUEPRINT.md
- docs/003-DOMAIN-DRIVEN-DESIGN.md
- docs/003.5-CONTRACT-FIRST-DESIGN.md (seluruh Contract, Schema, Validation Rules)
- docs/004-TECHNOLOGY-SELECTION-RECORD.md
- docs/004A-COST-SCALING-STRATEGY.md
- Implementasi ENGINEERING TASK 005.3 Registry System (packages/registry/**)

## Penting — Jangan

- Rewrite package Registry.
- Mengubah API public yang sudah ada (`IRegistry`, `Registry<TManifest>` constructor
  signature, existing `RegistryKind` values, existing manifest schemas' required fields).
- Menghapus Registry yang sudah dibuat.
- Mengubah Contract yang sudah valid.
- Mengubah struktur folder kecuali benar-benar diperlukan.
- Membuat breaking change.

Lakukan enhancement secara backward compatible.

## Objective

Menambahkan kemampuan Registry agar siap menjadi Enterprise Multi-Tenant Agentic
Platform. Target: Multi Industry, Unlimited Agent, Unlimited Tool, Unlimited Connector,
Solution Pack, Marketplace, Capability Driven Runtime.

## Enhancement 1 — Capability Registry

Capability adalah bahasa universal seluruh Agent. Capability BUKAN Tool. Capability
BUKAN Connector. Capability BUKAN Workflow. Capability hanyalah deskripsi kemampuan.

Contoh: `inventory.read`, `inventory.update`, `crm.findCustomer`, `crm.createLead`,
`marketing.generateContent`, `marketing.publish`, `ads.createCampaign`,
`ads.optimizeCampaign`, `calendar.createEvent`, `notification.send`, `knowledge.search`,
`reasoning.deep`, `image.generate`, `video.generate`, `voice.transcribe`.

Manifest wajib memiliki: ID, Namespace, Version, Description, Input Schema, Output
Schema, Permission, Provider List, Owner, Category, Industry, Tags, Status, Lifecycle,
Metadata.

Tambahkan: Capability Validator, Capability Loader, Capability Resolver Interface,
Capability Search, Capability Cache, Capability Version, Capability Metrics, Capability
Events.

JANGAN mengimplementasikan eksekusi capability. Resolver hanya interface. Implementasi
dilakukan pada ENGINEERING TASK 005.8.

## Enhancement 2 — Connector Registry

Connector adalah adapter menuju external system. Contoh: Facebook Graph, Instagram,
WhatsApp Cloud, Google Calendar, SMTP, Qonex CRM, Dealer Management System, SAP, Oracle,
Excel, CSV, Google Sheet, REST API, GraphQL, Webhook.

Setiap Connector: Manifest, Authentication, OAuth, Secret Reference, Supported
Capability, Version, Health, Status, Metadata, Rate Limit, Retry Policy, Timeout.

Belum membuat Connector Runtime. Belum memanggil API.

## Enhancement 3 — Solution Pack Registry

Contoh: Automotive Pack, Leasing Pack, Insurance Pack, Property Pack, Healthcare Pack,
Retail Pack, Hospitality Pack, Education Pack.

Setiap Solution Pack: Manifest, Industry, Agent List, Workflow List, Tool List,
Capability List, Prompt List, Dashboard List, Permission List, Policy List, Version,
Dependencies, License, Publisher.

Belum membuat Marketplace. Belum membuat Installer.

## Enhancement 4 — Industry Registry

Contoh: Automotive, Leasing, Property, Insurance, Healthcare, Retail, Manufacturing,
Education, Hospitality, General Business.

Industry Registry menjadi parent untuk Solution Pack.

## Enhancement 5 — Capability Namespace

Formal list: `inventory.*`, `crm.*`, `customer.*`, `sales.*`, `marketing.*`, `ads.*`,
`social.*`, `calendar.*`, `communication.*`, `workflow.*`, `reasoning.*`, `planning.*`,
`analytics.*`, `memory.*`, `knowledge.*`, `permission.*`, `tool.*`, `connector.*`,
`dashboard.*`, `system.*`, `tenant.*`.

Namespace harus tervalidasi. Tidak boleh duplicate.

## Enhancement 6 — Registry Dependency Graph

Graph baru: Agent Registry → Capability Registry → Tool Registry → Connector Registry →
Provider Registry → External System.

Graph harus dapat divalidasi. Support: Cycle Detection, Missing Dependency, Invalid
Version, Duplicate ID.

## Enhancement 7 — Model Profile Registry

Contoh: Claude, GPT, Gemini, KIE, OpenRouter, DeepSeek, Ollama, Bedrock, Azure OpenAI,
Vertex AI.

Setiap profile: Reasoning Score, Coding Score, Vision Score, Image Score, Video Score,
Latency, Pricing, Context Window, Recommended Use, Fallback, Provider.

Belum membuat AI Gateway.

## Enhancement 8 — Registry Manifest Standard

Semua Registry WAJIB memiliki Manifest. Minimum: id, name, displayName, description,
version, category, industry, owner, status, createdAt, updatedAt, dependencies,
metadata, tags.

## Enhancement 9 — Search Engine

Tambahkan Search by Namespace, Capability, Industry, Solution Pack, Connector, Tag,
Owner, Category.

## Enhancement 10 — Backward Compatibility

Seluruh perubahan WAJIB: tidak merusak implementasi 005.3, tidak mengubah public API,
tidak mengubah Contract, tidak mengubah Runtime.

## Test

Unit Test, Validation Test, Schema Test, Namespace Test, Manifest Test, Dependency Test,
Search Test.

## Output

Lakukan enhancement langsung ke implementasi Registry yang sudah ada. Jangan rewrite
package.

## Setelah Selesai — Laporan

File baru, file yang dimodifikasi, registry baru, dependency graph baru, capability
namespace, compatibility report, migration report, test coverage, known limitation.

Jangan mengimplementasikan Event Bus.

## Tambahan — Agent Blueprint Registry

Bukan Agent Runtime, tetapi template declarative untuk agent yang dapat dipakai oleh AI
Builder atau Marketplace.

```yaml
id: inventory-agent
industry: [automotive]
required_capabilities: [inventory.read, inventory.update]
required_tools: [dms-connector]
required_memory: [short-term]
required_workflows: [inventory-sync]
recommended_models: [gpt-5.5, claude-sonnet-5]
```
