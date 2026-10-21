# SkorPintar Ads Insight MVP 1 — Repository Audit & Architecture Freeze

Tanggal: 19 Oktober 2026. Scope: Phase 1B, audit dan rencana saja. Tidak mengubah production code, menjalankan migrasi, membuat iklan, atau memanggil generasi berbayar.

## 1. Executive Summary

**Keputusan: fondasi dapat digunakan kembali, tetapi MVP belum production-ready.** Repository memiliki pembacaan Meta nyata, integrasi OAuth, campaign assessment, policy versioning, approval claim, pekerjaan Kai persisten, penyimpanan media, dan scheduler. Masalah utamanya adalah beberapa jalur penulisan bersaing, kontrak antar-modul tidak konsisten, dan keberhasilan lokal belum selalu berarti hasil di Meta sudah terverifikasi.

Temuan paling mendesak:

- `PendingActionsService.enqueueRecommendation()` menghasilkan `REVIEW_SAMANTHA_RECOMMENDATION`, sedangkan `approve()` menolak jenis tersebut. Antrean rekomendasi belum menjadi alur approval yang dapat dieksekusi.
- Jalur property campaign dapat meninggalkan campaign tanpa ads, menangkap kegagalan publish per-ad, lalu tetap mengembalikan hasil campaign. Jalur approval bisa menandai paket `PUBLISHED` tanpa bukti jumlah ads yang benar.
- QA image pada runtime Kai baru menetapkan pemeriksaan visual/copy `passed: true`; gate publish paket juga belum mewajibkan QA/simulation terhadap hash aset final.
- Identitas tenant/role dashboard berasal dari `user_metadata`; backend mengandalkan API key bersama dan header tenant. Ini belum merupakan batas otorisasi multi-tenant yang cukup kuat.
- Runtime autonomous sendiri masih mengembalikan `ready: false`. Jangan mengganti label itu menjadi siap sebelum executor dan verifikasi selesai.

**Inventaris keputusan:** 7 P0 + 8 P1 = **15 production blockers**; **7 kelompok duplikasi kritis**; **16 kelompok modul reusable**; **8 kapabilitas inti yang belum lengkap**. Angka tersebut merujuk ke tabel bernomor di bagian 18, 20, 21, dan 22, bukan jumlah file.

Target loop yang dibekukan:

`Connect Meta → Samantha Audit → Decision → Evidence → Approve/Edit → Real Meta Action → Kai Refresh → Publish → Monitor → Outcome → Learn`.

### Batas bukti

- **CODE**: pembacaan source pada working tree saat audit, termasuk perubahan lokal/untracked yang sudah ada. Bukan sertifikasi clean commit atau build produksi.
- **LIVE-READ**: observasi read-only sebelumnya dalam sesi ini, 19 Oktober 2026: Meta connection test berhasil untuk akun SiapKPR; endpoint daftar campaign backend mengembalikan satu campaign, `SiapKPR PERJUANGAN`. Ini tidak membuktikan publish/scale/resume berhasil.
- **UNVERIFIED**: kondisi deployment, seluruh migrasi terpasang, browser E2E, kontrak currency Meta, dan write E2E belum dibuktikan oleh audit ini. Riwayat user menjalankan SQL tidak menggantikan pemeriksaan schema ledger.
- Test source yang ditemukan adalah bukti cakupan yang dirancang, bukan klaim test dijalankan dan lulus pada laporan ini. Tidak ada rangkaian test penuh dijalankan untuk perubahan dokumentasi ini.
- Browser inspection tidak berhasil dilakukan karena pembatasan tool. Screenshot desain dari percakapan bukan bukti fitur runtime.

## 2. Current Repository Architecture

Monorepo Turborepo/TypeScript. Composition root backend: `apps/aaos-api/src/app.module.ts`; bootstrap: `apps/aaos-api/src/create-app.ts`. API NestJS/Fastify menggunakan Supabase, modul domain, dan package adapters. Fastify mengaktifkan raw body untuk webhook; multipart global membatasi ukuran, sehingga batas upload UI perlu dicocokkan dengan backend.

| Area | Lokasi nyata | Kondisi / keputusan |
|---|---|---|
| API utama | `apps/aaos-api` | REUSE; satu backend MVP, bukan rewrite |
| Dashboard aktif | `apps/eyvra-dashboard-v2` | EXTEND; sumber UI MVP, observed local port 3003 |
| Dashboard lama | `apps/eyvra-dashboard`, `apps/aaos-dashboard` | DUPLICATED untuk product surface; keluarkan dari deployment MVP setelah dependency inventory |
| CRM | `apps/aaos-crm` | DO_NOT_CHANGE untuk bisnis existing; integrasikan lewat outcome contract |
| Simulator terpisah | `apps/aaos-simulator` | DEFER product surface; jangan hapus evaluator yang digunakan backend |
| Meta adapter | `packages/meta-ads-connector` | REUSE; Graph client aktual, bukan MCP yang hanya disebut di dokumen |
| Agent/creative packages | `packages/meta-ads-agent`, `packages/creative-agent`, `packages/creative-connector`, `packages/asset-library` | REUSE adapters/evaluators; konsolidasikan orchestration |
| Event runtime | `packages/event-bus` | PARTIAL; broker aplikasi tidak dikomposisikan dengan durable outbox |
| DB | `apps/aaos-api/supabase/migrations`, `packages/lead-store` | MIGRATE secara additive; ledger penerapan belum dibuktikan |

Arsitektur saat ini: Next BFF meneruskan session/context ke API; Nest menyusun connector global dan registry per-tenant; sebagian UI membaca Meta langsung melalui API, sebagian membaca snapshot Supabase. Perbedaan freshness ini perlu terlihat di UI.

Dokumen skill foundation/Meta/Kai/auth/simulation digunakan sebagai konteks, bukan dianggap bukti implementasi. Misalnya instruksi MCP di `skills/samantha/meta-mcp-integration.md` tidak berarti semua operasi aktual memakai MCP.

## 3. Frontend Route Map

Basis route berikut: `apps/eyvra-dashboard-v2/src/app`. Nav berada di `components/layout/navItems.ts` dan `components/layout/Sidebar.tsx` di bawah `src`.

| Route | File/komponen nyata | Audit |
|---|---|---|
| Login/session | `src/lib/auth.ts`, `src/middleware.ts` | Session divalidasi Supabase; claim authorization perlu diperbaiki |
| `/command-center` | `(app)/command-center/page.tsx`, `components/command-center` | Dashboard orchestration/snapshot; jangan samakan data snapshot dengan live Meta |
| `/campaigns` | `(app)/campaigns/page.tsx`, `components/campaigns/CampaignWorkspace.tsx` | Read nyata, filter/export; bukan operations console lengkap |
| `/campaigns/new` | `(app)/campaigns/new/page.tsx`, `components/campaign-builder/CampaignBuilderPage.tsx` | Draft/brief/preflight ada; publish runtime terfragmentasi |
| `/campaigns/[campaignId]` | `(app)/campaigns/[campaignId]/page.tsx`, `components/campaigns/CampaignDetailV2.tsx` | Detail/assessment; beberapa evidence/status jujur unavailable |
| `/listings`, `/listings/new`, `/listings/[id]`, `/listings/[id]/edit` | `(app)/listings` | CRUD/knowledge/source facts perlu dipertahankan |
| `/samantha` | `(app)/samantha/page.tsx`, `components/samantha/SamanthaOverview.tsx` | Overview/queue ada; action contract belum lengkap |
| `/samantha/[section]` | `(app)/samantha/[section]/page.tsx` | Decisions/audit/chat/settings memakai komponen bersama; chat/settings belum implementasi penuh |
| `/samantha/simulation`, `/samantha/simulation/compare` | `(app)/samantha/simulation` | Evaluasi dan compare; bukan bukti hasil iklan aktual |
| `/samantha/stress-test`, `/run`, `/[runId]` | `(app)/samantha/stress-test` | Persona/copy/claim evaluation backend tersedia |
| `/kai-studio` | `(app)/kai-studio/page.tsx`, `components/kai/KaiStudioHub.tsx` | View projects/assets/queue; beberapa panel roadmap |
| `/kai-studio/[briefId]` | `(app)/kai-studio/[briefId]/page.tsx`, `components/kai/KaiProductionWorkspace.tsx` | Konsep/jobs persisten; sebagian kontrol editor tidak masuk enqueue payload |
| `/automation`, `/automation/growth-settings` | `(app)/automation`, `components/automation/GrowthSettings.tsx` | Policy tersimpan; autonomous availability belum siap |
| `/leads`, `/experiments`, `/activity`, `/settings`, `/growth-objectives` | `(app)/[section]/page.tsx` | Placeholder “Coming in V2”; REMOVE FROM MVP UI sampai tersedia |

`comingSoon` pada nav bukan pengaman: Sidebar tetap merender link. Link mobile `/more` perlu route coverage test; tidak boleh diasumsikan tersedia dari label. Branding EYVRA/Adssiera/SiapKPR di source/desain perlu satu migrasi terkontrol ke SkorPintar Ads Insight.

## 4. Backend Module Map

Semua path pada tabel ini relatif ke `apps/aaos-api/src/modules/`. Klasifikasi menilai kelengkapan alur, bukan sekadar keberadaan folder.

| Modul | Evidence utama | Status | Tindakan |
|---|---|---|---|
| Meta read/write | `meta-ads/meta-ads.service.ts`, `meta-ads/infrastructure/meta-ads-connector-registry.ts` | REUSE / EXTEND | Satu connector tenant-aware |
| OAuth/config | `meta-oauth/meta-oauth.controller.ts`, `meta-oauth-config` | EXTEND | Satu credential source/version |
| Campaign reads/property writer | `campaigns/campaigns.service.ts` | BROKEN / DUPLICATED | Pertahankan queries; pindah mutations ke executor |
| Blueprint/creation request | `campaign-creation/campaign-creation.service.ts` | PARTIAL | Basis canonical campaign runtime |
| Go-live | `go-live/go-live.service.ts` | DUPLICATED | Adapter ke executor, bukan writer kedua |
| Assessment | `campaign-health/campaign-health.service.ts` | REUSE | Evidence/version/snapshot identity wajib |
| Approval | `pending-actions/pending-actions.service.ts` | BROKEN / EXTEND | Selaraskan action types dan execution state |
| Policy | `automation-policy/growth-policy.service.ts`, `automation-policy/domain/policy-engine.ts` | REUSE / DUPLICATED | Satu policy engine, explicit precedence |
| Kai | `creative-packages/kai-planning.service.ts`, `creative-packages/kai-production.worker.ts` | REUSE / EXTEND | Runtime persisten canonical |
| Legacy generation | `creative-packages/creative-packages.service.ts` | DUPLICATED | Compatibility façade ke runtime Kai |
| Listings/knowledge | `listings`, `listing-knowledge` | REUSE | Fakta/provenance tenant-scoped |
| CRM/leads | `leads`, `sales`, `closings`, `whatsapp-webhook` | PARTIAL / DO_NOT_CHANGE | Outcome boundary; audit tenant default |
| Activity/audit | `activity-log/activity-logger.service.ts`, `audit-log` | EXTEND | Trace bersama, fungsi log tetap berbeda |
| Scheduler | `scheduler/scheduler.service.ts`, `scheduler/infrastructure/loop-runtime.repository.ts` | PARTIAL | Hilangkan fallback tanpa lease |
| Learning | `learning/learning.service.ts`, `creative-memory`, `judge-memory` | PARTIAL | Pisahkan prompt learning dan business outcome |
| Intelligence | `intelligence/intelligence.service.ts`, `market-intelligence`, `meta-interests` | PARTIAL | Reuse evidence, jangan janjikan full competitor product |
| Simulation/QA | `simulation`, `creative-stress-test`, `ai-judge` | EXTEND | Gate final-artifact version |
| AB test/lookalike | `abtesting/abtesting.service.ts`, `lookalike` | DEFER / DUPLICATED writer | Nonaktifkan jalur bypass pada MVP |
| Metrics/overview | `metric-snapshot`, `overview`, `command-center`, `meta-sync` | REUSE | Timestamp dan source freshness |
| Superadmin/auth boundary | `superadmin/superadmin.controller.ts`, `meta-ads/guards/api-key.guard.ts` | BROKEN boundary | Server-side trusted authorization |

Modul lain seperti branches, region, recycling, sosmed, scraper, sandbox dan prompt-override tidak otomatis dihapus. Inventaris dependency harus mendahului retirement; keluarkan hanya surface yang tidak masuk MVP.

## 5. Database / Domain Model Map

Source migrations bukan bukti schema live. Migration inventory API sampai `072_kai_reviewed_enqueue.sql`; `_pending_042_to_051_combined.sql` berpotensi menduplikasi penerapan file bernomor. `packages/lead-store` memiliki schema/migration sendiri. Reconcile ledger sebelum migrasi baru.

| Entity / ID | Representasi existing dan evidence | Gap / relasi canonical |
|---|---|---|
| Tenant / Workspace | `tenants`, `common/tenant-context.ts`, registry Meta | Tenant ID string; jangan fallback ke tenant lain; membership terverifikasi |
| User | Supabase auth user ID; dashboard `src/lib/auth.ts` | Role/tenant harus trusted membership, bukan editable metadata |
| Meta Integration | Kolom token/manual/OAuth tenant; `meta-oauth`, `settings` | Integration ID, credentialVersion, expiresAt, account allowlist |
| Ad Account | Graph `act_…`, registry dan meta-sync | AccountID external + tenant scope; jangan JS numeric IDs |
| Campaign / AdSet / Ad | Graph string IDs, `meta-sync`, connector | Snapshot ID tidak sama dengan Graph ID; simpan hierarchy dan integration |
| CampaignDraft | Migration `064_campaign_creative_handoff.sql`; BFF `app/api/campaign-drafts/route.ts` | DB draft/revision versus legacy filesystem; immutable publish revision |
| Creation request | `058_campaign_creation_requests.sql` | Idempotent request ada; perlu per-step child receipts |
| SamanthaDecision | `056_samantha_campaign_assessments.sql`, pending actions | Assessment ID bukan executable action ID; immutable evidence/version |
| Action | `pending_agent_actions`, `070_pending_action_execution.sql` | Status execution ada; belum ledger steps/reconciliation lengkap |
| KaiProject / CreativeBrief | `064_campaign_creative_handoff.sql`; `domain/structured-creative-brief.ts` | Project/package/brief IDs harus eksplisit; jangan interchangeable |
| Concept / Storyboard / GenerationJob | `065_kai_production_lifecycle.sql`, `066_kai_generation_enqueue.sql`, `071`, `072` | Revision/lease/sample-review ada; perlu frozen finishing inputs |
| CreativeAsset | `creative_packages`, worker output JSON/GCS/hash, `assets` | Normalisasi raw/source/final/preview; ordered carousel; asset version |
| QA | Job `output.qa`, simulation/judge modules | QA ID, artifact hash, evaluator version dan approval identity terpisah |
| Simulation | `simulation`, `062_creative_stress_test_runs.sql`, `063` | Simulation bukan live outcome; link exact final asset revision |
| Lead | `packages/lead-store`, API `leads` | Tenant-scoped attribution ke campaign/ad; CRM identity mapping |
| CRM Outcome | `closings`, sales flow, WhatsApp/lead-store | Unified stage event, occurredAt, dedupe/source/ad linkage belum lengkap |
| AgentActivity | `agent_activities`, `activity-log` | Satu correlationId + action/job/provider IDs |
| GrowthPolicy | `069_growth_policy.sql`, `growth-policy.service.ts` | Versioned policy ada; sources lain perlu compatibility precedence |
| LearningMemory | `learning_proposals`, `creative-memory`, `judge-memory` | Pisahkan observasi, outcome, proposal, approved model/prompt version |
| Scheduled work | `calendar_events`, `loop_runs`, `067`, `068` | Distributed claim sebagian; durable event delivery belum universal |

Migrations 064/065 menggunakan pembatasan service-role dan relasi tenant untuk workflow baru: **pertahankan**, jangan longgarkan agar UI bisa menulis langsung. Proposed additive schema: action steps/attempts/receipts; integration credential versions; asset versions/QA attestations; outcome events; durable outbox. Nama final tabel baru harus diputuskan saat implementasi, bukan dianggap sudah ada.

## 6. Authentication Audit

Evidence: `apps/eyvra-dashboard-v2/src/lib/auth.ts`, `src/middleware.ts`, `src/lib/route-session.ts`; API `src/common/tenant-context.ts`, `src/modules/meta-ads/guards/api-key.guard.ts`, `src/modules/superadmin/superadmin.controller.ts`.

Login → Supabase `getUser()` → dashboard session → BFF → API key + tenant headers. Validasi user Supabase adalah fondasi yang benar. Tetapi role, tenant, vertical diturunkan dari `user_metadata`, dengan default `dss-motor`/AUTOMOTIVE saat claim hilang. Metadata pengguna bukan sumber hak akses yang dipercaya. API key memverifikasi caller server, bukan user tenant membership.

Superadmin controller mengandalkan API key dan role check upstream. Growth policy controller membaca role dari header. Backend perlu trusted identity context, explicit membership dan role checks untuk setiap mutation/admin route. Hilangkan default tenant pada authenticated request; missing membership harus fail closed.

`route-session.ts` memakai response sementara untuk refresh; propagasi cookie refresh perlu integration test. Middleware mengecualikan API, sehingga semua BFF route tetap wajib auth. Jangan menganggap middleware melindungi API secara otomatis. Audit ini tidak melakukan exploit atau membuktikan semua route dapat dieksploitasi; boundary source sudah cukup untuk blocker P0-01.

## 7. Meta Ads Integration Audit

Canonical adapter candidate: `packages/meta-ads-connector/src/infrastructure/meta-api/MetaApiClient.ts`; tenant resolution: `apps/aaos-api/src/modules/meta-ads/infrastructure/meta-ads-connector-registry.ts`.

SUPPORTED berarti implementation ada, **bukan seluruh account/permission live sudah tervalidasi**.

| Capability | Status | Bukti dan batas |
|---|---|---|
| Credential loading | PARTIAL | Registry tenant manual/OAuth/env; cache tidak otomatis melihat edit SQL |
| Connection test | SUPPORTED | `settings` testMetaConnection; LIVE-READ berhasil |
| Account/campaign read | SUPPORTED | MetaApiClient getAdAccount/getCampaigns; LIVE-READ satu campaign |
| Adset/ad read | SUPPORTED | getAdSets/getAds; current full-account coverage belum diuji |
| Insights | SUPPORTED | Connector + `meta-sync`, `metric-snapshot`; freshness berbeda dari live list |
| Create campaign | PARTIAL | Real Graph request; beberapa orchestrator, orphan risk |
| Create adset | PARTIAL | Real Graph request; property promoted-object/context mismatch |
| Create creative/ad | PARTIAL | createAd, uploadImage/uploadVideo; error parsial tidak selalu menghentikan publish |
| Pause/resume | PARTIAL | pauseAd/pauseAdSet/activateCampaign/activateAd tersedia; belum satu role/policy/receipt path |
| Budget update | PARTIAL | scaleAdSetBudget ada; autonomous recommendation executor belum lengkap |
| Post-write verification | MISSING as shared contract | Tidak ada verifikasi end-to-end wajib untuk setiap mutation |
| Idempotency | PARTIAL | Creation request claim dan approval claim ada; tidak universal per Graph side effect |
| Error handling | PARTIAL | Adapter retries/errors ada; property catches errors dan tetap return |
| Rate limiting/retry | PARTIAL | Connector mechanisms ada; retry mutation harus membedakan safe-read dan uncertain-write |
| Permission diagnostics | PARTIAL | OAuth/test ada; “connected” bukan bukti Page/WA/action-specific access |

Registry menyimpan connector yang sudah resolve; update melalui Settings menginvalidasi cache, edit token/account langsung di DB tidak melakukan itu. `testMetaConnection` dapat membaca data terbaru sementara campaign runtime masih menggunakan cached connector. Bekukan versioned invalidation, jangan gunakan restart sebagai solusi produk.

`packages/meta-ads-connector/src/utils/CurrencyUtils.ts` memakai faktor 100 secara umum, termasuk IDR. Kontrak satuan budget per currency perlu fixture dan round-trip provider proof sebelum scale diaktifkan. Audit tidak menyatakan satuan yang benar tanpa pembuktian provider.

Manual Graph ads client, OAuth token exchange, WhatsApp Graph dan CAPI adalah bounded contexts berbeda. Jangan menghapus WhatsApp/CAPI karena sama-sama memakai Graph. Yang harus tunggal adalah **ads mutation transport dan authorization context**.

## 8. Samantha Audit

Evidence utama: `apps/aaos-api/src/modules/campaign-health/campaign-health.service.ts`, `pending-actions/pending-actions.service.ts`, `scheduler/scheduler.service.ts`, `automation-policy/domain/policy-engine.ts`, dashboard `components/samantha/SamanthaOverview.tsx`.

| Tahap | Status | Temuan |
|---|---|---|
| Observation | REUSE | Current/previous metrics dan lifetime input tersedia |
| Signal | REUSE | Benchmark/signal detection domain nyata |
| Diagnosis | REUSE | Assessment menggabungkan sinyal/diagnosis |
| Decision | PARTIAL | Rekomendasi tersedia; bukan otomatis executable command |
| Opportunity | PARTIAL | Modules `opportunities`/growth tersedia; prioritas lintas campaign belum satu kontrak |
| Policy | PARTIAL | Policy engine kuat tetapi tidak semua writer melewatinya |
| Planning | PARTIAL | Blueprint/brief/portfolio plan ada; execution plan version belum seragam |
| Execution | BROKEN | Recommendation type tidak diterima approve; SCALE belum lengkap |
| Monitoring | PARTIAL | Scheduler dan snapshots; assessment persistence best effort |
| Outcome | PARTIAL | Meta metrics tersedia; CRM outcomes belum universal |
| Learning | PARTIAL | Prompt/config proposals dan creative performance, bukan causal outcome loop lengkap |

`enqueueRecommendation()` menggunakan daily deterministic ID, baik untuk mengurangi duplicate queue. Namun `approve()` hanya menerima CREATE_PROPERTY_CAMPAIGN, REVIEW_CREATIVE_BRIEF, PUBLISH_CAMPAIGN_FROM_ASSET, RESTRUCTURE_CAMPAIGN. Menambahkan card UI tidak menyelesaikan mismatch ini.

Policy version diperiksa ulang dan approval diklaim atomik. Ini harus dipertahankan. Catch yang mengubah semua kegagalan menjadi EXECUTION_UNCERTAIN perlu diperinci: validation failure tanpa side effect berbeda dari timeout setelah provider menerima request. Uncertain membutuhkan reconciliation, bukan tombol retry buta.

Samantha wajib menyimpan evidence snapshot, alasan, policy version, proposed before/after, expected outcome dan confidence. Approval/edit harus menghasilkan revision baru; perubahan setelah approval membatalkan approval lama.

## 9. Kai / KIE Audit

Evidence: `apps/aaos-api/src/modules/creative-packages/kai-planning.service.ts`, `kai-production.worker.ts`, `kai-production-media.service.ts`, `infrastructure/kai-production.repository.ts`, `domain/structured-creative-brief.ts`, `kie-webhook.service.ts`; provider adapter `packages/creative-connector/src/infrastructure/kie-api/KieAiGenerationClient.ts`.

| Capability | Status | Detail |
|---|---|---|
| Structured brief | REUSE | Listing/source facts, destination, ratios, format quantities, provenance |
| Concepts/storyboards | REUSE | Persisted revisions dan reviewed enqueue |
| Image | PARTIAL | Job ada; final image runtime baru dibangun dari source photo, bukan generated pixels |
| Video | PARTIAL | KIE generation, FFmpeg scene/final assembly; QA sampling terbatas |
| Carousel | PARTIAL | Plan/multiple images ada; ordered Meta carousel publish belum terbukti |
| KIE callbacks | REUSE | Shared-secret guard; callback hanya wake lalu provider poll, tidak mempercayai URL callback |
| Model routing | PARTIAL | Video worker memakai VEO3_FAST; pilihan UI belum satu capability registry |
| Asset persistence | REUSE / EXTEND | GCS output/hash; raw provider artifact belum dipertahankan di semua jalur |
| Finishing | PARTIAL | Sharp/SVG/FFmpeg deterministic compositor sudah ada |
| Typography/CTA | PARTIAL | Fixed overlay/wrapping; belum brand-safe layout dan overflow checks penuh |
| QA | BROKEN for image acceptance | `assess()` memberi image visual/copy passed true tanpa pemeriksaan |
| Simulation | PARTIAL | Evaluators ada; gate final version belum menyatu publish |
| Handoff/replacement | PARTIAL | Package sync/Meta ad IDs ada; variant-to-final-asset lineage belum lengkap |

Worker baru: QUEUED → SUBMITTING → RUNNING → INGESTING → QA → READY/SAMPLE_READY/QA_FAILED. DB lease, heartbeat, retry dan revision checks adalah fondasi yang baik. Recovered SUBMITTING menjadi uncertain untuk mencegah paid submission kedua: **DO_NOT_CHANGE invariant ini**.

Jawaban eksplisit:

1. **Apakah raw KIE langsung menjadi final?** Pada runtime baru, tidak untuk video: output diolah/overlay. Pada image, `ingest()` men-download output provider tetapi final dirender ulang dari source photo; generated pixels tidak digunakan. Maka tidak boleh menyebut hasil image tersebut sebagai hasil KIE yang sudah difinalisasi tanpa menjelaskan asalnya. Legacy generation path harus ditutup ke runtime yang sama sebelum ada jaminan global.
2. **Apakah compositor deterministic ada?** Ya: `productionOverlay`, `renderSourceMotion`, image Sharp, video FFmpeg, `assembleVideo`. Masih fixed-layout, video menghapus audio, dan kontrol musik/subtitle UI belum berarti finishing tersebut tersedia.
3. **Apakah aset tersimpan dan publish-ready?** Final bytes/hash/GCS tersimpan. Itu belum cukup untuk publish-ready: image QA bypass, final QA belum universally enforced, dan output package bukan attestation terhadap exact artifact revision.

`syncPackage()` menggunakan satu copy variant dari unit awal, dapat menimpa copy sebelumnya dan hanya memetakan satu video utama. Property publishing memakai satu media utama untuk berbagai copy variants. Harapan user “lebih dari satu content” memerlukan plan variant → final asset → creative/ad mapping yang eksplisit.

## 10. Campaign Operations Audit

Ada tiga orchestration paths: `campaigns/campaigns.service.ts`, `campaign-creation/campaign-creation.service.ts`, `go-live/go-live.service.ts`; AB testing juga melakukan writes. Ini bukan satu transactional campaign runtime.

Temuan konkret:

- `CreateCampaign.execute()` di `packages/meta-ads-connector/src/application/use-cases/CreateCampaign.ts` membuat campaign lalu adset. `promotedObjectPageId` dikirim dalam createCampaign input, tidak pada createAdSet input di use case ini. Perbaiki destination contract di tempat yang benar, bukan global Page fallback.
- General create dalam CampaignsService memakai config tenant; property create masih memakai config META_PAGE_ID dan listing WA, bukan seluruh selected immutable destination context.
- `domain/property-targeting.builder.ts` memilih hasil city pertama, membatasi radius, dan mengirim `matchedCities.slice(0,1)`. Rencana multi-location tidak otomatis sama dengan payload Meta.
- `publishPropertyAds()` menangkap error per-ad dan lanjut. Campaign dengan nol ads bisa terlihat berhasil. `getForCampaignPublish()` hanya mengambil paket tenant-scoped, belum memaksa QA/simulation/approval gate.
- CampaignCreationService memiliki request claim/reclaim dan partial-failure campaign ID, tetapi createOnMeta berhenti pada campaign/adset. Jangan menampilkan ini sebagai complete publish.

Minimum operation contract: command immutable; tenant/account/destination fixed; full payload preview; policy preflight; idempotent action claim; per-step receipts; read-back; explicit PARTIAL/UNCERTAIN state; resume known steps. Campaign ID saja tidak memenuhi “published”. LIVE membutuhkan effective status/delivery confirmation, bukan sekadar request accepted.

## 11. Lead / CRM Audit

Evidence: `apps/aaos-crm`, `packages/lead-store`, `apps/aaos-api/src/modules/leads`, `sales`, `closings/closings.service.ts`, `whatsapp-webhook`, `whatsapp`, dan `packages/capi-connector`.

Lead/conversation/closing workflows nyata sudah ada. WhatsApp webhook dan attribution plumbing tidak sama dengan complete Respon Pintar outcome integration. `ClosingsService` menggunakan config tenant untuk bagian run logging: perlu memastikan tenant scope konsisten dengan lead mutation, bukan hanya data tampil benar.

Samantha UI menampilkan unavailable untuk metrik CRM yang tidak tersedia; pertahankan kejujuran tersebut. Jangan menjadikan raw Meta leads sebagai qualified/hot leads.

CRM **bukan syarat** untuk campaign read, analysis, approval, produksi creative, atau scale berbasis Meta metrics. Policy berbasis qualified leads/CPQL memerlukan CRM evidence; jika tidak ada, gunakan objective/measurement basis yang tersedia dan tampilkan batasnya.

Canonical outcome contract yang belum lengkap: tenantId, source, externalEventId, leadId, campaignId/adId bila diketahui, stage, value/currency, occurredAt, receivedAt, attribution confidence. Ingestion harus dedupe; late events tidak boleh menggandakan hasil learning.

## 12. Activity / Scheduler Audit

Evidence: `apps/aaos-api/src/modules/activity-log/activity-logger.service.ts`, `audit-log`, `scheduler/scheduler.service.ts`, `scheduler/infrastructure/loop-runtime.repository.ts`, `apps/aaos-api/src/app.module.ts`, `packages/event-bus/src/broker/event-broker.ts`.

ActivityLogger mencatat start/complete/fail; AuditLog menyimpan mutation/rollback evidence. Keduanya berguna dan berbeda, tetapi belum satu timeline dengan actionId/jobId/provider receipt. Banyak logging bersifat best effort; kegagalan evidence persistence tidak boleh tetap dianggap sukses untuk uang/publish.

Scheduler mempunyai dispatch nyata, cron, calendar events dan runtime lease di balik ADVERTISING_LOOP_RUNTIME_V2. Jalur legacy tanpa claim masih ada. Meta sync, token refresh, accuracy checks, overview snapshots dan Kai interval adalah specialist workers, bukan otomatis duplikasi; semuanya perlu ownership, lease, retries dan health reporting konsisten.

EventBroker dikomposisikan `new EventBroker()` di aplikasi; interfaces event-store saja tidak membuat publish durable. Broker yang aktif tidak menyediakan transactional outbox aplikasi. Crash antara DB commit dan publish dapat kehilangan pekerjaan.

Freeze: SchedulerService menjadi registry/jadwal canonical; DB claim untuk seluruh due work; Kai worker tetap specialized consumer. Outbox + retry/DLQ untuk transisi penting. Tidak perlu mengganti semua cron dengan platform baru sebelum contract ini stabil.

## 13. Growth Settings / Policy Audit

Evidence: `apps/aaos-api/src/modules/automation-policy/growth-policy.service.ts`, `domain/policy-engine.ts`, `domain/growth-readiness.ts`, dashboard `components/automation/GrowthSettings.tsx`.

GrowthPolicy versioned persistence dan optimistic concurrency ada. Policy checks mencakup budgets, cooldown, tracking, learning protection dan conditional CRM requirements. Ini basis yang layak digunakan.

Masalah: `evaluateGrowthPolicy` dan `evaluateAutomationPolicy` berjalan bersama sumber lain: property objectives auto-loop/publish, growth objectives, agent configs/overrides, tenant mode dan config flags. Tidak ada satu enforcement boundary untuk semua writers.

`growth-readiness.ts` secara eksplisit belum siap untuk scaling executor/creative cross-campaign trigger. Presence KIE key atau Meta config bukan verifikasi provider operational. Jangan mengakali readiness dengan boolean true.

Freeze precedence: safety invariants → tenant GrowthPolicy revision → scoped campaign overrides yang memperketat → action evidence/current provider state. Legacy settings diadaptasi saat read/migration; tidak boleh diam-diam mengalahkan policy baru. Copilot berarti approval manusia; autonomous hanya action types yang sudah punya executor+verification dan lulus policy.

## 14. Learning / Memory Audit

Evidence: `apps/aaos-api/src/modules/learning/learning.service.ts`, `learning`, `creative-memory`, `judge-memory`, `prompt-override`, `sandbox`.

Existing LearningService menerima simulation/agent-run evaluation, mendeteksi gap, menghasilkan improvement proposal, dan memiliki approval/rollback flow untuk prompt/config. Creative memory menghubungkan published Meta ad IDs dengan performance. Ini bukan modul kosong.

Gap: tidak ada satu outcome dataset yang menghubungkan decision version → approved action → verified Meta state → exposure window → business outcome. Array ad IDs di package bukan unique relational lineage; duplicate mappings dapat membuat atribusi ambigu.

Freeze: observation memory, creative memory dan prompt proposal tetap berbeda; LearningService menjadi orchestrator evaluasi. Perubahan policy/prompt wajib versioned, measurable, reversible. Jangan auto-apply rekomendasi LLM berdasarkan simulasi sebagai bukti peningkatan revenue. Cold-start harus eksplisit, bukan seeded success rate.

## 15. Competitor Intelligence Audit

Evidence: `apps/aaos-api/src/modules/intelligence/intelligence.service.ts`, `market-intelligence`, `packages/meta-ads-agent/src/intelligence/CompetitorIntelService.ts`.

Competitor ad-library/Graph retrieval dan angle-oriented intelligence tersedia. Source sendiri mencatat keterbatasan coverage provider; coverage komersial Indonesia saat ini belum diverifikasi dalam audit. Jangan menjanjikan semua iklan kompetitor dapat diambil.

Belum complete product: source evidence snapshot/retention, dedupe creative, visual analysis, provenance ke Kai brief, legal/source availability status, dan competitor UI yang terhubung penuh. Phase 7 harus mendukung source URL/upload yang diizinkan bila provider tidak menyediakan coverage. Pisahkan inspirasi kreatif dari klaim performa kompetitor; spend/conversion yang tidak diketahui tidak boleh dibuat-buat.

## 16. Security Audit

| Area | Evidence | Temuan / keputusan |
|---|---|---|
| Trusted identity | dashboard `src/lib/auth.ts`; API `common/tenant-context.ts` | P0: editable metadata/default tenant dan trusted header boundary |
| Admin authorization | `modules/superadmin/superadmin.controller.ts` | API key bukan admin user authorization |
| Secret encryption | `common/encryption.service.ts` | AES-256-GCM dengan random IV/auth tag tersedia; REUSE |
| Secret consistency | `settings`, `meta-oauth`, tenant token fields, `waba_configs` | Manual/plaintext dan encrypted paths coexist; migrate secrets, jangan print nilainya |
| Webhook integrity | `create-app.ts`, Meta/WhatsApp guards, KIE guard | Raw body/signature checks dan KIE secret checks dipertahankan |
| KIE callback | `creative-packages/kie-webhook.service.ts` | Wake-only + provider re-fetch baik; jangan percaya body sebagai final asset |
| Query secret exposure | KIE callback configuration | Perlu redaction URL/query pada proxy/log/APM; exposure actual tidak dibuktikan |
| Asset downloads | `kai-production-media.service.ts` | HTTPS check ada; host/redirect/private-IP/size policy perlu security test, belum dinyatakan exploit |
| Storage | GCS final assets | Review public URL/PII/retention; hash tidak menggantikan authorization |
| DB | migrations 064/065 dan legacy schemas | Pertahankan service-role constraints; audit semua RLS berdasarkan trusted membership |

Tidak ada token ditampilkan di laporan. Service key harus tetap server-side. Integrasi Meta test harus melaporkan action capabilities per account/Page/WA tanpa mengekspos credential. Token refresh/rotation harus menginvalidasi connector lintas proses.

## 17. Production Readiness Audit

| Domain | Evidence level | Kesimpulan |
|---|---|---|
| Meta connection/read | CODE + LIVE-READ | Foundation berfungsi; account freshness harus diperbaiki |
| Meta complete write | CODE, UNVERIFIED E2E | Tidak siap: partial publish, duplicate/reconciliation gaps |
| Kai generation/storage | CODE | Runtime substantif; acceptance/lineage belum aman |
| Approval/scale | CODE | Recommendation approval mismatch; scale contract belum selesai |
| Auth/tenant isolation | CODE | Production blocker |
| Scheduler/restarts | CODE | Partial lease; durable delivery belum universal |
| CRM-independent mode | CODE | Secara desain memungkinkan; jangan memblokir semua fungsi karena CRM |
| Database/deployment | UNVERIFIED | Ledger/env/build/worker topology perlu acceptance |
| Monitoring/learning | CODE | Banyak building blocks; closed-loop evidence belum lengkap |

Release criteria: setiap operation punya tenant test, deterministic payload test, provider read-back, restart/timeout test, and audit trace. Tidak ada “success” jika hanya parent campaign dibuat. Tidak ada “ready to publish” jika QA tidak memeriksa artefak yang benar.

## 18. Duplicate / Conflicting Architecture

**7 kelompok duplikasi kritis**. Ini duplikasi ownership/alur, bukan alasan menghapus semua file yang namanya mirip.

| ID | Competing paths | Canonical / retirement |
|---|---|---|
| D01 | `campaigns/campaigns.service.ts`, `campaign-creation/campaign-creation.service.ts`, `go-live/go-live.service.ts`, connector CreateCampaign | CampaignCreationService plan/runtime; semua writes melalui ActionExecutor; legacy façades |
| D02 | `meta-ads/meta-ads.service.ts` verdict, `abtesting/abtesting.service.ts`, pending actions direct calls | Satu mutation executor; AB test hanya propose actions |
| D03 | API global connector/config versus `meta-ads-connector-registry.ts` | Tenant integration context wajib; hapus default global dari request-scoped operations |
| D04 | `creative-packages.service.ts` legacy orchestration versus `kai-production.worker.ts` | Persisted worker canonical; adapters reuse, legacy enqueue compatibility |
| D05 | Old automation evaluator, GrowthPolicy, property objectives flags, agent/tenant modes | Versioned GrowthPolicy precedence; migrate reads before remove fields |
| D06 | Three dashboards + Next filesystem campaign drafts versus DB drafts | V2 UI and Supabase drafts canonical; import/reconcile, then retire fallback |
| D07 | Scheduler legacy dispatch versus leased loop runtime; activity without shared correlation | Leased runtime + one timeline contract; keep audit/domain logs as linked evidence |

OAuth/WhatsApp/CAPI clients, QA/simulation, activity/audit, and creative/judge memories are **not inherently duplicates**. Their responsibilities remain distinct behind a single orchestration boundary.

## 19. Dead-End UI / Fake Action Audit

| UI / action | Evidence | Finding | Required outcome |
|---|---|---|---|
| Leads/Experiments/Activity/Settings links | `(app)/[section]/page.tsx`, navItems, Sidebar | Placeholder despite clickable navigation | Hide from MVP or implement real route |
| Samantha chat/settings sections | `SamanthaOverview.tsx` | Explicitly not connected | Label unavailable; no fake send/save success |
| Recommendation approve | `pending-actions.service.ts` | Unsupported queued action type | Typed action registry and execution result |
| Autonomous toggle | `growth-readiness.ts` | Explicit not-ready | Finish executors; do not falsify readiness |
| Kai finishing/model/quantity controls | `KaiProductionWorkspace.tsx` | Local state; enqueue payload sends IDs/renderMode/reviewed revisions | Save controls in versioned plan and consume in worker |
| Reference Intelligence | `KaiStudioHub.tsx` | Explicit unconnected panel | Defer or Phase 7 evidence ingestion |
| Kai settings voices/music/cost | `KaiStudioHub.tsx` | Unavailable/roadmap | Remove unsupported controls from MVP |
| Asset readiness | `kai-production.repository.ts`, media service | Storage/package status not QA acceptance | Show source/final/QA separately |
| Campaign published | property writer + PendingActionsService | Can represent zero ads/partial execution | Verified counts and child statuses |
| CRM KPIs / growth estimates | SamanthaOverview + growth policy | Explicit unavailable values | Keep unavailable; never replace with mock success |

Tidak ditemukan dasar untuk menyatakan semua dashboard metrics “fake”. Live Meta reads dan explicit empty states ada. Risiko utama adalah status keberhasilan yang terlalu luas, local-only settings, dan placeholders. Export CSV/filter UI adalah tindakan frontend yang sah; tidak harus menjadi backend mutation.

## 20. Reuse Matrix

**16 kelompok reusable**, termasuk yang membutuhkan extension/refactor. Ini bukan 16 modul selesai produksi.

| ID | Module / evidence | Disposition | Rationale |
|---|---|---|---|
| R01 | `packages/meta-ads-connector/src/infrastructure/meta-api/MetaApiClient.ts` | KEEP+EXTEND | Existing Graph operations; receipts/currency/error contracts |
| R02 | API `meta-ads/infrastructure/meta-ads-connector-registry.ts` | REFACTOR | Tenant connector + credential version invalidation |
| R03 | API `common/encryption.service.ts`, `meta-oauth` | KEEP+EXTEND | Encryption/OAuth, migrate manual secrets |
| R04 | API `campaign-creation/campaign-creation.service.ts` | KEEP+EXTEND | Blueprint/preflight/idempotent creation request |
| R05 | API `campaign-health/campaign-health.service.ts` | KEEP+EXTEND | Signal/assessment evidence |
| R06 | API `pending-actions/pending-actions.service.ts` | REFACTOR | Keep atomic claim; typed execution lifecycle |
| R07 | API `automation-policy/domain/policy-engine.ts` | KEEP+EXTEND | Canonical policy enforcement |
| R08 | API `listings`, `listing-knowledge` | KEEP+EXTEND | Facts/provenance grounding |
| R09 | API `creative-packages/kai-planning.service.ts` | KEEP+EXTEND | Brief/concepts/versioned planning |
| R10 | API `creative-packages/kai-production.worker.ts` | KEEP+EXTEND | Leases/restart-aware paid jobs |
| R11 | `packages/creative-connector` + KIE webhook | KEEP+EXTEND | Provider submission/poll; wake-only invariant KEEP AS-IS |
| R12 | Kai media service + `packages/asset-library` | REFACTOR | Deterministic finishing, storage/QA lineage |
| R13 | API `simulation`, `creative-stress-test`, `ai-judge` | KEEP+EXTEND | Evaluators, hash-bound final gates |
| R14 | API `activity-log`, `audit-log`, `scheduler` | REFACTOR | Existing records/leases; durable trace |
| R15 | API `learning`, `creative-memory`, `judge-memory` | KEEP+EXTEND | Existing proposals/memory; outcomes needed |
| R16 | `apps/eyvra-dashboard-v2`, API `meta-sync`, `metric-snapshot` | KEEP+EXTEND | Active product/read models |

REMOVE FROM MVP UI: generic placeholder routes and unsupported Kai controls. DEFER: full AB testing/lookalike/sosmed/simulator surfaces. DO_NOT_CHANGE: existing CRM functionality, wake-only callbacks, atomic claims, tenant constraints, source provenance and honest missing-data states. REMOVE means retire a path after compatibility cutover, never delete historical data blindly.

## 21. Missing Capability Matrix

**8 missing or incomplete core capabilities**. Proposed modules below do not exist merely because they are named here.

| ID | Capability | Existing foundation | Needed |
|---|---|---|---|
| M01 | Trusted tenant authorization | Supabase getUser/API key | Server membership resolver + role/tenant guards |
| M02 | Unified action execution | PendingActions + creation requests | Typed registry, steps/attempts, receipts, reconciliation |
| M03 | Complete campaign publish | Meta client/property/create paths | Versioned plan → all adsets/ads → verified read-back |
| M04 | Final asset acceptance | Worker/GCS/compositor | Asset versions, real image QA, final hash attestations |
| M05 | Durable orchestration | Scheduler lease/EventBroker | Outbox, idempotent consumers, recovery/DLQ |
| M06 | Business outcome learning | Lead-store/learning/memory | Attribution contract, outcome windows and evaluated changes |
| M07 | Competitor evidence workflow | CompetitorIntelService | Coverage-aware ingestion, visuals/provenance/Kai handoff |
| M08 | Production release evidence | Health/tests/migrations | Schema ledger, deployment checks, monitoring and investor E2E |

## 22. Production Blockers

Priority definition: P0 blocks safe real writes or the promised core loop; P1 blocks reliable multi-tenant MVP release. Counts are **7 P0, 8 P1, total 15**. Some are missing verification contracts, not observed provider incidents.

| ID | Severity | Blocker / evidence | Exit proof |
|---|---|---|---|
| P0-01 | P0 | Auth editable metadata/default tenant/shared-key-only authorization; auth.ts/tenant-context/superadmin | Forged/missing/cross-tenant identities denied server-side |
| P0-02 | P0 | Wrong/global campaign destination/tenant and targeting truncation; CampaignsService/CreateCampaign/property-targeting.builder | Selected tenant/account/Page/WA and approved geo exactly match read-back |
| P0-03 | P0 | Partial campaign create and zero-ad publish considered success; CampaignsService/PendingActions | One resumable hierarchy; expected ads verified; no duplicate parents |
| P0-04 | P0 | Image QA bypass + unenforced package publish gate; Kai media/getForCampaignPublish | Final asset hash passes real claim/visual/layout checks before publish |
| P0-05 | P0 | Currency/budget conversion not provider-verified; CurrencyUtils | IDR and other supported currency fixtures + provider round-trip |
| P0-06 | P0 | Recommendation type rejected; SCALE executor not complete | Analysis → queue → evidence → approve → real verified command |
| P0-07 | P0 | No universal post-write reconciliation; uncertain actions can strand or duplicate effects | Timeout/restart fault tests reconcile existing objects before retry |
| P1-01 | P1 | Credential/account registry cache can remain stale after DB edits | Version change refreshes all runtime contexts; UI reports selected account |
| P1-02 | P1 | Legacy scheduler/no transactional outbox | Multi-worker claim and crash recovery tests |
| P1-03 | P1 | Raw/final/variant lineage, model controls and carousel incomplete | Ordered formats/variants persisted and exact assets published |
| P1-04 | P1 | Competing policy sources and mutation bypasses | Every writer traverses policy + executor; version change cancels stale approval |
| P1-05 | P1 | Placeholder UI/local-only edits/filesystem draft fallback | All visible MVP actions persist; no conflicting draft source |
| P1-06 | P1 | Outcome attribution/learning loop incomplete | Deduped outcomes link verified actions; CRM-absent mode truthful |
| P1-07 | P1 | Mixed plaintext/encrypted secret paths and incomplete security verification | Secret migration/rotation/redaction/RLS/download tests |
| P1-08 | P1 | Applied schema/build/deployment/investor E2E not verified | Reproducible release, schema check, traceable one-cycle E2E |

Nonblocking roadmap after core stabilization: full competitor breadth, advanced voice/music/subtitle tooling, AB tests/lookalikes, broader CRM UI. Do not market these as completed MVP capabilities before their own acceptance.

## 23. Architecture Freeze

**Status: canonical architecture selected for planning; not implemented or production-certified.** No parallel replacement stacks. Keep adapters/domain logic; consolidate orchestration incrementally.

| Responsibility | Canonical owner | Boundary |
|---|---|---|
| Auth | Supabase identity + proposed API `modules/auth` trusted membership resolver | BFF forwards identity; API validates authorization itself |
| Meta API | Existing MetaApiClient through tenant registry | Only Graph ads transport; no business policy inside transport |
| Campaign CRUD/runtime | Existing CampaignCreationService extended; CampaignsService query façade | Draft/blueprint/hierarchy plan, never independent direct writer |
| Campaign mutation | Proposed `modules/actions/action-executor.service.ts` | Sole entry to approved side effects |
| Decision engine | CampaignHealthService/domain + recommendation adapter | Evidence-based recommendations, never implicit writes |
| Policy engine | `automation-policy/domain/policy-engine.ts` evaluateGrowthPolicy | Fail closed; versioned context, universal preflight |
| Action/approval | PendingActionsService + proposed action registry/ledger | Separate approval state from execution state |
| Kai runtime | KaiPlanningService + KaiProductionWorker/repository | Immutable reviewed plan, leased jobs |
| KIE | Existing creative-connector adapter/poller/webhook wake | Provider truth re-fetch, no raw callback completion |
| Storage | Asset-library adapter + normalized asset versions | Raw/source/final lineage and immutable content hashes |
| Activity | ActivityLogger timeline + AuditLog immutable receipts | Shared correlation/action/job IDs; no duplicate semantic log owners |
| Scheduler | SchedulerService + LoopRuntimeRepository | One durable schedule/claim contract; specialized consumers |
| Learning | LearningService + outcome evaluation extension | Separate memory types, approved/versioned changes |
| Growth Policy | GrowthPolicyService/repository | Sole configurable policy source, explicit legacy adapters |

### Canonical Meta write flow

Trusted identity → scoped account/destination → frozen command/revision → current evidence → policy → approval if required → atomic action claim → persist step intent → provider call → persist receipt → provider read-back → verified step → next step → complete timeline/outcome schedule.

Timeout after possible side effect → UNCERTAIN → reconciliation. Never blindly recreate campaign/adset/ad. Permission test and provider readiness are checked per action, not inferred from a generic connected badge.

### Canonical creative flow

Campaign plan → structured brief with provenance → reviewed concepts/storyboard/finishing settings → job claim → KIE task or explicit source-motion mode → retain raw artifact → deterministic final composition → immutable asset version → QA against exact final artifact → simulation/review policy → shortlist → campaign plan variant mapping → preflight → action executor publish.

### Canonical autonomous flow

Scheduled metrics ingest → persisted assessment → typed proposed action → eligibility with full evidence → Copilot approval or explicitly allowed Autonomous action → same executor → read-back → monitor window → outcome event → evaluated learning proposal. CRM optional for Meta-only objectives; mandatory only for objectives requiring CRM evidence.

### Current flow continuity map

| Flow | Current bridge | Break / freeze |
|---|---|---|
| Login → dashboard | Supabase auth + BFF | Trusted membership missing |
| Meta connect → campaign read | Settings/OAuth → registry → campaign query | Cache invalidation/version |
| Campaign → Samantha | Metrics/snapshots → assessment | Persist evidence failure must be visible |
| Samantha → Action | scheduler enqueue → pending actions | Action type mismatch |
| Samantha → Kai | brief approval/auto-loop → package/planning | Legacy and new runtime consolidate |
| Kai → KIE | worker → creative connector | Fixed model versus UI contract |
| KIE → Asset | poll/wake → media ingestion/GCS | Retain raw + verify final image |
| Asset → Campaign | package publish selection | Exact QA/hash/variant gate missing |
| Campaign → Meta | multiple writers | Canonical executor required |
| Meta → CRM | WhatsApp/CAPI/lead attribution pieces | Unified outcome event contract |
| CRM → Learning | closings/memory/proposals pieces | Verified action-to-outcome lineage missing |

Migration strategy: additive schema → dual-read/compatibility adapters → scoped backfill/reconciliation → switch one writer → verify → retire old path. Preserve original IDs and receipts. Never run overlapping combined/individual migration scripts blindly. No data deletion is authorized by this audit.

## 24. Phase 2–10 Implementation Plan

Order is intentional. Phase 2 is branding/navigation only; production mutation remains gated until Phases 3–6 and release checks pass.

| Phase | Exact scope / paths | DB / API / UI changes | Tests and exit criteria |
|---|---|---|---|
| 2 Brand Migration | `apps/eyvra-dashboard-v2/src/components/layout/Sidebar.tsx`, `navItems.ts`, `src/app/layout.tsx`, `(app)/[section]/page.tsx` | No domain rename or destructive DB migration. Central brand config proposed. Hide unavailable surfaces; product name SkorPintar Ads Insight | Route/link coverage, visual smoke; no legacy product name in active chrome, no misleading ready labels |
| 3 Meta Production Hardening | API `common/tenant-context.ts`, `modules/meta-ads/guards/api-key.guard.ts`, `modules/meta-ads/infrastructure/meta-ads-connector-registry.ts`, `modules/settings`, `modules/meta-oauth`; dashboard `src/lib/auth.ts`; connector `MetaApiClient.ts`, `CurrencyUtils.ts` | Add trusted membership/context and credential version/secret migration. Capability diagnostics/account identity/freshness API; UI action-specific status | Cross-tenant/role denial, credential rotation, pagination/errors/rate-limit/currency fixtures; read-only account and hierarchy consistent across UI/API |
| 4 Campaign Operations | API `modules/pending-actions`, `modules/campaign-creation`, `modules/campaigns`, `modules/go-live`; proposed `modules/actions`; dashboard CampaignWorkspace/CampaignDetailV2/CampaignBuilderPage | Add execution steps/receipts/reconciliation schema and typed commands. Approve/edit/reject/execute/status APIs; exact geo/destination preview; persist draft source | Concurrent approval, timeout after create, resume missing children, zero-ad failure, pause/resume/budget read-back; no duplicate hierarchy |
| 5 Samantha Growth | API `modules/campaign-health`, `modules/automation-policy`, `modules/pending-actions`, `modules/scheduler`; dashboard SamanthaOverview/GrowthSettings | Persist evidence/version and typed recommendations; one policy precedence; queue/evidence/decision revision UI | Recommendation accepted by executor; policy/kill-switch recheck; stale edit invalidates approval; CRM-absent Meta objective works |
| 6 Kai Simplification | API `modules/creative-packages/kai-planning.service.ts`, `kai-production.worker.ts`, `kai-production-media.service.ts`, repository; `packages/creative-connector`; dashboard KaiProductionWorkspace/KaiStudioHub | Asset versions/QA attestation/variant lineage; persist editor settings; one runtime; raw/final library and ordered formats | Provider callback duplicates, job restart, image claim rejection, overlay overflow, video frames, exact hash gate, multi-content publish; no unconditional image pass |
| 7 Competitor Intelligence | API `modules/intelligence/intelligence.service.ts`, `packages/meta-ads-agent/src/intelligence/CompetitorIntelService.ts`; proposed source-evidence model/UI in Samantha | Evidence snapshots/provenance/retention and coverage status; visual/angle analysis; Kai brief references | Provider unavailable/empty/missing metrics represented honestly; source link traceability and no fabricated competitor performance |
| 8 Activity / Scheduler | API `modules/activity-log`, `modules/audit-log`, `modules/scheduler`, `packages/event-bus`, `src/app.module.ts`; replace activity placeholder route | Durable outbox/consumer dedupe, universal leased jobs, trace read API and activity page | Two-worker contention, crash/commit/publish recovery, DLQ/replay, timeline action→provider receipt; no unleased production branch |
| 9 Adaptive Learning | API `modules/learning`, `modules/creative-memory`, `modules/judge-memory`, `modules/closings`, `packages/lead-store`; proposed outcome ingest/evaluation | Outcome event schema/attribution and evaluation windows; versioned proposal API; visible evidence/rollback | Duplicate/late outcomes, missing CRM, no attribution, holdout/regression evaluation; no unsupported automatic improvement claims |
| 10 Production Hardening + Investor E2E | API `src/create-app.ts`, `src/app.module.ts`, migration directories, relevant `*.spec.ts`; dashboard BFF routes and deployment config | Schema ledger verification, env/worker health, secure logs, observability, runbook; additive fixes only | Clean build/tests, two-tenant isolation, real approved one-cycle E2E with complete Meta children and verified status; restart/retry proof and evidence bundle |

Approval to begin implementation is not implied by this report. User explicitly requested stopping after audit. No Phase 2 changes are included.

## 25. Recommended File-by-File Work Order

All entries are repository-relative actual files/directories unless marked **NEW (proposed)**. Resolve under `C:\Users\HP\Documents\Agentic Otonom Sales`. This is implementation order, not a claim these changes were made.

1. Phase 2: `apps/eyvra-dashboard-v2/src/components/layout/Sidebar.tsx`, `navItems.ts`, `src/app/layout.tsx`; establish central branding without changing IDs/routes.
2. Phase 2: `apps/eyvra-dashboard-v2/src/app/(app)/[section]/page.tsx`; remove dead navigation exposure; retain valid feature routes.
3. Phase 3: `apps/eyvra-dashboard-v2/src/lib/auth.ts`, `src/lib/route-session.ts`, `src/middleware.ts`; trusted session/refresh contract.
4. Phase 3: **NEW (proposed)** `apps/aaos-api/src/modules/auth/tenant-authorization.service.ts`; then `src/common/tenant-context.ts`, `modules/meta-ads/guards/api-key.guard.ts`, `modules/superadmin/superadmin.controller.ts`.
5. Phase 3: `apps/aaos-api/src/common/encryption.service.ts`, `modules/settings`, `modules/meta-oauth`, `modules/meta-oauth-config`; prepare additive secret/integration migration in `apps/aaos-api/supabase/migrations` only after ledger review.
6. Phase 3: `apps/aaos-api/src/modules/meta-ads/infrastructure/meta-ads-connector-registry.ts` and its `.spec.ts`; integration-version refresh.
7. Phase 3: `packages/meta-ads-connector/src/utils/CurrencyUtils.ts`, `src/infrastructure/meta-api/MetaApiClient.ts`; verified budget units, provider receipts/errors.
8. Phase 4: `apps/aaos-api/src/modules/pending-actions/pending-actions.service.ts` and tests; define accepted action registry and separate approval/execution outcomes.
9. Phase 4: **NEW (proposed)** `apps/aaos-api/src/modules/actions/action-executor.service.ts`, `action-reconciliation.service.ts`; additive action-step storage after `070` compatibility review.
10. Phase 4: `apps/aaos-api/src/modules/campaign-creation/campaign-creation.service.ts`; full plan execution and durable child IDs.
11. Phase 4: `packages/meta-ads-connector/src/application/use-cases/CreateCampaign.ts`; correct promoted-object contract or reduce to low-level façade used by canonical executor.
12. Phase 4: `apps/aaos-api/src/modules/campaigns/campaigns.service.ts`, `domain/property-targeting.builder.ts`; remove global context/geo truncation/zero-ad success.
13. Phase 4: `apps/aaos-api/src/modules/go-live/go-live.service.ts`, `modules/abtesting/abtesting.service.ts`, `modules/meta-ads/meta-ads.service.ts`; reroute writes, retire bypasses.
14. Phase 4: `apps/eyvra-dashboard-v2/src/app/api/campaign-drafts/route.ts`, `components/campaign-builder/CampaignBuilderPage.tsx`, `components/campaigns/CampaignWorkspace.tsx`, `CampaignDetailV2.tsx`; DB-only draft cutover and real operation status.
15. Phase 5: `apps/aaos-api/src/modules/campaign-health/campaign-health.service.ts`, `infrastructure/campaign-assessment.repository.ts`; durable evidence required for actions.
16. Phase 5: `apps/aaos-api/src/modules/automation-policy/domain/policy-engine.ts`, `domain/growth-readiness.ts`, `growth-policy.service.ts`; canonical precedence and executor-based readiness.
17. Phase 5: `apps/aaos-api/src/modules/scheduler/scheduler.service.ts`, `modules/pending-actions/pending-actions.service.ts`; typed analysis-to-queue bridge.
18. Phase 5: `apps/eyvra-dashboard-v2/src/components/samantha/SamanthaOverview.tsx`, `components/automation/GrowthSettings.tsx`; evidence modal, edit revision, approve/reject/result.
19. Phase 6: `apps/aaos-api/src/modules/creative-packages/domain/structured-creative-brief.ts`, `kai-planning.service.ts`, `infrastructure/kai-production.repository.ts`; persist finishing/format variant contract.
20. Phase 6: `apps/aaos-api/src/modules/creative-packages/kai-production-media.service.ts`; preserve raw media and implement real image/final artifact QA.
21. Phase 6: `apps/aaos-api/src/modules/creative-packages/kai-production.worker.ts`, `kie-webhook.service.ts`, `creative-packages.service.ts`; one persisted runtime and enforced publish gate.
22. Phase 6: `apps/eyvra-dashboard-v2/src/components/kai/KaiProductionWorkspace.tsx`, `KaiStudioHub.tsx`, `KaiMediaInspector.tsx`; wire saved settings and show raw/final/QA lineage.
23. Phase 7: `packages/meta-ads-agent/src/intelligence/CompetitorIntelService.ts`, `apps/aaos-api/src/modules/intelligence/intelligence.service.ts`; evidence ingestion and coverage-aware API before competitor UI.
24. Phase 8: `apps/aaos-api/src/modules/scheduler/infrastructure/loop-runtime.repository.ts`, `scheduler.service.ts`, `src/app.module.ts`; all production jobs leased.
25. Phase 8: `packages/event-bus/src/broker/event-broker.ts` integration plus **NEW (proposed)** `apps/aaos-api/src/modules/outbox/outbox.service.ts`; durable dispatch without replacing domain broker unnecessarily.
26. Phase 8: `apps/aaos-api/src/modules/activity-log/activity-logger.service.ts`, `modules/audit-log`; unified trace read model; replace placeholder activity page.
27. Phase 9: `apps/aaos-api/src/modules/closings/closings.service.ts`, `modules/leads`, `packages/lead-store`; scoped outcome events before learning automation.
28. Phase 9: `apps/aaos-api/src/modules/learning/learning.service.ts`, `modules/creative-memory`, `modules/judge-memory`; action-to-outcome evaluation and approved changes.
29. Phase 10: `apps/aaos-api/src/create-app.ts`, `src/app.module.ts`, existing module `*.spec.ts`, both migration roots; deployment/schema/security/fault tests and release evidence.
30. Phase 10: active dashboard BFF routes and investor flow: connect → audit → evidence → approve → Kai final/QA → full Meta hierarchy → monitor/outcome. Use one trace ID and prove no duplicate side effects; actual live activation requires the intended budget/account configuration.

### Completion record

Deliverable: this report only. Canonical ownership and Phase 2–10 order are documented. Production readiness is **NOT READY**, architecture plan is **FROZEN FOR IMPLEMENTATION REVIEW**. Next recommended task: **Phase 2 — Brand Migration**, followed by security/Meta hardening before further real write tests.
