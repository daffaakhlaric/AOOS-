"use client";
import { MetaLeadDestination } from "@/components/listings/MetaLeadDestination";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { mapListingToListItem, type ListingInventory } from "@/lib/listings";
import { draftListingStrategy } from "@/lib/listing-strategy";
import { selectPropertyInterests, type StoredInterest } from "@/lib/meta-interests";
import { budgetPeriod, goals, type BuilderDraft, type BusinessGoal } from "@/lib/campaign-builder";
import type { KaiPackage } from "@/lib/kai-studio";
import s from "./CampaignBuilder.module.css";
const money = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
function Card({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className={s.card}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
async function read<T>(url: string, signal: AbortSignal): Promise<T> {
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error("Layanan belum tersedia");
  return r.json();
}
export function CampaignBuilderPage() {
  const query = useSearchParams(),
    router = useRouter();
  const [inventory, setInventory] = useState<ListingInventory>();
  const [error, setError] = useState("");
  const [listingId, setListingId] = useState(query.get("listingId") ?? "");
  const [goal, setGoal] = useState<BusinessGoal>("WhatsApp Leads");
  const [budget, setBudget] = useState(0);
  const [start, setStart] = useState(""),
    [end, setEnd] = useState("");
  const [name, setName] = useState("");
  const [draftRevision, setDraftRevision] = useState(0);
  const [handoff, setHandoff] = useState<BuilderDraft>();
  const [destination, setDestination] = useState({ pageId: "", adAccountId: "", number: "" });
  const [copyIndex, setCopyIndex] = useState(0),
    [step, setStep] = useState(0),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("");
  const [picker, setPicker] = useState(false);
  const [id, setId] = useState(""),
    [saved, setSaved] = useState(""),
    [saving, setSaving] = useState(false);
  const [interests, setInterests] = useState<StoredInterest[]>([]),
    [interestError, setInterestError] = useState(false);
  const [packages, setPackages] = useState<KaiPackage[]>(),
    [kaiError, setKaiError] = useState(false);
  const [documents, setDocuments] = useState<number>(),
    [docsError, setDocsError] = useState(false);
  const [meta, setMeta] = useState<{
      adAccountId: string;
      pages: { id: string; name: string }[];
      warning?: string;
    }>(),
    [metaError, setMetaError] = useState(false);
  const [role, setRole] = useState(""),
    [email, setEmail] = useState("");
  useEffect(() => {
    const c = new AbortController();
    setId(crypto.randomUUID());
    read<ListingInventory>("/api/listings", c.signal)
      .then(setInventory)
      .catch(() => {
        if (!c.signal.aborted)
          setError("Listing gagal dimuat. Muat ulang halaman untuk mencoba lagi.");
      });
    read<{ role: string; email?: string }>("/api/workspace", c.signal)
      .then((v) => {
        setRole(v.role);
        setEmail(v.email ?? "");
      })
      .catch(() => {});
    read<{
      adAccountId: string;
      pages: { id: string; name: string }[];
      warning?: string;
    }>("/api/listing-editor/listings/lead-destinations", c.signal)
      .then(setMeta)
      .catch(() => {
        if (!c.signal.aborted) setMetaError(true);
      });
    read<StoredInterest[]>("/api/meta-interests", c.signal)
      .then(setInterests)
      .catch(() => {
        if (!c.signal.aborted) setInterestError(true);
      });
    read<{ packages: KaiPackage[] }>("/api/creative?limit=200", c.signal)
      .then((v) => setPackages(v.packages))
      .catch(() => {
        if (!c.signal.aborted) setKaiError(true);
      });
    const draftId = query.get("draftId");
    if (draftId)
      read<BuilderDraft>("/api/campaign-drafts?id=" + encodeURIComponent(draftId), c.signal)
        .then((d) => {
          setId(d.id);
          setListingId(d.listingId);
          setName(d.name);
          setGoal(d.goal);
          setBudget(d.dailyBudget);
          setStart(d.start);
          setEnd(d.end);
          setCopyIndex(d.copyIndex);
          setDraftRevision(d.revision ?? 0);
          setHandoff(d);
          if (d.metaDestination) setDestination(d.metaDestination);
          setSaved("Draft dimuat dari server.");
        })
        .catch(() => {
          if (!c.signal.aborted) setError("Draft gagal dimuat; jangan menimpa draft lama.");
        });
    return () => c.abort();
    // Initial URL context is restored once; subsequent builder edits are local until Save Draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    setDocuments(undefined);
    setDocsError(false);
    if (!listingId) return;
    const c = new AbortController();
    read<unknown>(
      "/api/listing-editor/listing-knowledge/" + encodeURIComponent(listingId),
      c.signal,
    )
      .then((v) => {
        const body = v as { documents?: unknown[] };
        setDocuments(Array.isArray(v) ? v.length : body.documents?.length);
      })
      .catch(() => {
        if (!c.signal.aborted) setDocsError(true);
      });
    return () => c.abort();
  }, [listingId]);
  const items = inventory?.listings.map((r) => mapListingToListItem(r, inventory.campaigns)) ?? [];
  const item = items.find((i) => i.listing.id === listingId),
    strategy = item ? draftListingStrategy(item) : undefined;
  const copy = strategy?.variants[copyIndex];
  const period = budgetPeriod(start, end, budget);
  const available = packages?.filter((p) => p.listingId === listingId) ?? [];
  const active = item?.health.linked?.filter((c) => c.status === "ACTIVE") ?? [];
  const selectedInterests = item
    ? selectPropertyInterests(interests, item.listing.propertyType)
    : [];
  const generatedName =
    name ||
    (item
      ? `${item.listing.city ?? "Properti"} - ${item.listing.title} - ${goal}`.slice(0, 200)
      : "");
  const canSave = ["owner", "manager", "superadmin"].includes(role) && !!item;
  function choose(value: string) {
    setPicker(false);
    setListingId(value);
    setId(crypto.randomUUID());
    setDraftRevision(0);
    setHandoff(undefined);
    setDestination({ pageId: "", adAccountId: "", number: "" });
    setName("");
    setCopyIndex(0);
    setSaved("");
    const selected = items.find((i) => i.listing.id === value);
    setGoal(selected?.listing.waNumber ? "WhatsApp Leads" : "Meta Lead Form");
  }
  async function save(openKai = false) {
    if (!item || saving) return;
    setSaving(true);
    setSaved("");
    try {
      const response = await fetch("/api/campaign-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          listingId,
          name: generatedName,
          goal,
          dailyBudget: budget,
          start,
          end,
          copyIndex,
          metaDestination: destination,
          revision: draftRevision,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setDraftRevision(data.revision);
      setHandoff(data);
      if (openKai && data.status === "READY" && data.kaiProjectId && data.kaiBriefId) {
        router.push(`/kai-studio/${data.kaiBriefId}?project=${data.kaiProjectId}`);
        return;
      }
      router.replace(
        "/campaigns/new?draftId=" +
          encodeURIComponent(data.id) +
          "&listingId=" +
          encodeURIComponent(listingId),
        { scroll: false },
      );
      setSaved(
        data.status === "NEEDS_INPUT"
          ? "Draft tersimpan. Lengkapi brief: " + (data.missingFields ?? []).join(", ")
          : "Draft dan proyek Kai tersimpan · " +
              new Date(data.updatedAt).toLocaleTimeString("id-ID"),
      );
    } catch (e) {
      setSaved(e instanceof Error ? e.message : "Draft gagal disimpan.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <main className={s.page}>
      <div className={s.top}>
        <Link
          href={
            query.get("listingId")
              ? "/listings/" + encodeURIComponent(query.get("listingId")!)
              : "/campaigns"
          }
        >
          ← Kembali
        </Link>
        <span>Automation: belum diperiksa</span>
        <span>{email}</span>
      </div>
      <small>Campaigns › Campaign Builder</small>
      <h1>Campaign Builder</h1>
      <p className={s.subtitle}>
        Samantha menyiapkan campaign dari listing, tujuan bisnis, dan aset Anda.
      </p>
      <nav className={s.stepper} aria-label="Tahap campaign">
        {["Strategy", "Audience", "Creatives", "Review", "Launch"].map((label, i) => (
          <button
            key={label}
            aria-current={step === i ? "step" : undefined}
            className={step === i ? s.current : ""}
            onClick={() => {
              setStep(i);
              document
                .getElementById("builder-" + i)
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            <b>{i + 1}</b>
            <span>
              {label}
              <small>
                {
                  [
                    "Fondasi campaign",
                    "Rencana audience",
                    "Rencana creative",
                    "Periksa draft",
                    "Validasi sebelum publish",
                  ][i]
                }
              </small>
            </span>
          </button>
        ))}
      </nav>
      {error && (
        <p role="alert" className={s.warning}>
          {error}
        </p>
      )}
      {step === 4 && (
        <p className={s.warning}>
          Launch diblokir: validasi Meta, policy, tracking, creative QA, dan automation belum
          lengkap. Draft tidak menerbitkan iklan.
        </p>
      )}
      <div className={s.layout}>
        <div className={s.column}>
          <Card id="builder-0" title="▧ Selected Listing">
            {item && (
              <button className={s.change} onClick={() => setPicker(!picker)}>
                {picker ? "Tutup pilihan" : "Ganti listing"}
              </button>
            )}
            {(!item || picker) && (
              <>
                <label>
                  Pilih listing
                  <input
                    placeholder="Cari judul, area, atau ID"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <select
                  aria-label="Filter listing"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="">Semua listing</option>
                  <option value="ready">Ready for Ads</option>
                  <option value="active">Aktif</option>
                  <option value="none">Belum ada campaign</option>
                  <option value="TANAH">Tanah</option>
                  <option value="RUMAH">Rumah</option>
                  <option value="APARTEMEN">Apartemen</option>
                  <option value="RUKO">Ruko</option>
                </select>
                <select
                  aria-label="Selected listing"
                  value={listingId}
                  onChange={(e) => choose(e.target.value)}
                >
                  <option value="">
                    {inventory ? "Pilih listing untuk memulai" : "Memuat listing…"}
                  </option>
                  {items
                    .filter(
                      (i) =>
                        i.listing.id === listingId ||
                        (`${i.listing.title} ${i.location} ${i.listing.id}`
                          .toLowerCase()
                          .includes(search.toLowerCase()) &&
                          (!filter ||
                            (filter === "ready"
                              ? i.health.state === "READY_FOR_ADS"
                              : filter === "active"
                                ? i.listing.listingStatus === "AKTIF"
                                : filter === "none"
                                  ? i.health.linked?.length === 0
                                  : i.listing.propertyType === filter))),
                    )
                    .sort(
                      (a, b) =>
                        Number(b.health.state === "READY_FOR_ADS") -
                        Number(a.health.state === "READY_FOR_ADS"),
                    )
                    .map((i) => (
                      <option key={i.listing.id} value={i.listing.id}>
                        {i.listing.title} · {i.price} · {i.health.label}
                      </option>
                    ))}
                </select>
              </>
            )}
            {item ? (
              <>
                <div className={s.property}>
                  {item.images[0] && <img src={item.images[0]} alt={item.listing.title} />}
                  <div>
                    <h3>{item.listing.title}</h3>
                    <p>{item.location}</p>
                    <strong>{money(item.listing.price)}</strong>
                    <p>
                      <span className={s.badge}>{item.health.label}</span> {item.type}
                    </p>
                  </div>
                </div>
                <div className={s.actions}>
                  <Link href={"/listings/" + listingId + "/edit"}>Edit Listing</Link>
                  <Link href={"/listings/" + listingId}>View Detail</Link>
                </div>
              </>
            ) : (
              <p>Pilih listing untuk memuat strategi dan preview.</p>
            )}
            {active.length > 0 && (
              <div className={s.warning}>
                <b>Active campaign exists</b>
                {active.map((c) => (
                  <p key={c.id}>
                    <Link href={"/campaigns/" + c.id}>{c.name} →</Link>
                  </p>
                ))}
                Tinjau campaign aktif sebelum membuat acquisition baru.
              </div>
            )}
          </Card>
          <Card title="◎ Business Goal">
            <div className={s.goals}>
              {goals.slice(0, 3).map((g) => (
                <button
                  key={g}
                  aria-pressed={goal === g}
                  onClick={() => {
                    setGoal(g);
                    setSaved("");
                  }}
                >
                  {g}
                </button>
              ))}
            </div>
            <select
              aria-label="Business goal lainnya"
              value={goal}
              onChange={(e) => {
                setGoal(e.target.value as BusinessGoal);
                setSaved("");
              }}
            >
              {goals.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
            <small>
              {item?.listing.waNumber
                ? "Usulan awal: WhatsApp Leads karena tujuan WhatsApp listing terisi. Koneksi Meta belum terverifikasi."
                : "Usulan awal: Meta Lead Form; formulir dan destination perlu dikonfigurasi."}{" "}
              Qualified Leads memerlukan integrasi kualitas lead.
            </small>
          </Card>
          <Card title="▣ Budget & Duration">
            <label>
              Daily Budget (Rp)
              <input
                type="number"
                min="0"
                max="10000000000"
                value={budget || ""}
                placeholder="Masukkan budget"
                onChange={(e) => {
                  setBudget(Number(e.target.value));
                  setSaved("");
                }}
              />
            </label>
            <div className={s.pair}>
              <label>
                Mulai
                <input
                  type="date"
                  value={start}
                  onInput={(e) => {
                    setStart(e.currentTarget.value);
                    setSaved("");
                  }}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <label>
                Selesai
                <input
                  type="date"
                  value={end}
                  min={start}
                  onInput={(e) => {
                    setEnd(e.currentTarget.value);
                    setSaved("");
                  }}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </label>
            </div>
            <p>
              Total rencana <strong>{period.valid ? money(period.total) : "—"}</strong> ·{" "}
              {period.days} hari (inklusif)
            </p>
            <small>
              Budget dan periode wajib sebelum menyimpan. Tidak ada budget yang diterapkan ke Meta.
            </small>
            <div className={s.callout}>
              <b>Estimated Qualified Leads</b>
              <p>Data historis belum cukup untuk forecast atau rekomendasi budget.</p>
            </div>
          </Card>
          <Card title="♧ Audience Summary">
            <p>{strategy?.audience.center || "Pilih listing"}</p>
            <p>{strategy?.audience.age || "—"}</p>
            <p>{strategy ? `${strategy.audience.radiusKm} km · rekomendasi awal` : "—"}</p>
            <small>Supported: belum diperiksa · Applied: belum</small>
          </Card>
        </div>
        <div className={s.column}>
          <Card title="✧ Samantha Strategy">
            <div className={s.callout}>
              <b>Draft strategi · berdasarkan fakta listing</b>
              <p>
                {item
                  ? `Mulai dengan ${goal}. ${strategy?.rationale}`
                  : "Pilih listing untuk menyusun strategi."}
              </p>
            </div>
            <div className={s.chips}>
              <span>Listing facts</span>
              <span>{item?.listing.photos.length ?? 0} foto tersimpan</span>
              <span>
                {docsError
                  ? "Knowledge unavailable"
                  : documents === undefined
                    ? "Knowledge belum dimuat"
                    : `${documents} dokumen`}
              </span>
            </div>
            <small>Market demand, daya beli, dan kualitas visual belum dianalisis model.</small>
          </Card>
          <Card title="▱ Campaign Structure">
            <div className={s.structure}>
              <div>
                <b>1</b>Campaign
              </div>
              <span>→</span>
              <div>
                <b>1</b>Primary Ad Set
              </div>
              <span>→</span>
              <div>
                <b>—</b>Launch shortlist
              </div>
            </div>
            <small>
              Usulan struktur awal. Creative capacity belum dapat dihitung tanpa expected delivery,
              budget tervalidasi, dan QA. {available.length} paket Kai terkait; bukan jumlah iklan
              siap launch.
            </small>
          </Card>
          <Card id="builder-1" title="♧ Audience Recommendation">
            <dl>
              <dt>Age</dt>
              <dd>{strategy?.audience.age ?? "—"}</dd>
              <dt>Geo</dt>
              <dd>{strategy?.audience.center || "Lokasi belum diisi"}</dd>
              <dt>Radius</dt>
              <dd>
                {strategy
                  ? `${strategy.audience.radiusKm} km · draft, belum supported/applied`
                  : "—"}
              </dd>
              <dt>Interest</dt>
              <dd>
                {interestError
                  ? "Katalog gagal dimuat"
                  : selectedInterests.length
                    ? selectedInterests.map((i) => (
                        <span key={i.id} title={"Meta ID: " + i.id}>
                          {i.name} ·{" "}
                        </span>
                      ))
                    : "Belum ada kandidat relevan"}
              </dd>
              <dt>Behavior</dt>
              <dd>Broad prospecting; retargeting membutuhkan event dan Custom Audience.</dd>
              <dt>Placement</dt>
              <dd>Usulan otomatis · capability belum diperiksa</dd>
              <dt>Destination</dt>
              <dd>
                {goal === "WhatsApp Leads"
                  ? item?.listing.waNumber || "WhatsApp belum diisi"
                  : "Perlu konfigurasi sesuai business goal"}
              </dd>
            </dl>
            <small>{strategy?.audience.validation}</small>
          </Card>
          <Card title="▤ Copy & Offer">
            <label>
              Copy angle
              <select
                value={copyIndex}
                onChange={(e) => {
                  setCopyIndex(Number(e.target.value));
                  setSaved("");
                }}
              >
                {strategy?.variants.map((v, i) => (
                  <option key={v.angle} value={i}>
                    {v.angle}
                  </option>
                ))}
              </select>
            </label>
            <dl>
              <dt>Primary Text</dt>
              <dd>{copy?.primaryText ?? "Pilih listing"}</dd>
              <dt>Headline</dt>
              <dd>{copy?.headline ?? "—"}</dd>
              <dt>Description</dt>
              <dd>{copy?.description ?? "—"}</dd>
              <dt>CTA</dt>
              <dd>
                {goal === "WhatsApp Leads"
                  ? "Hubungi via WhatsApp"
                  : "Pelajari Selengkapnya · draft"}
              </dd>
              <dt>Source</dt>
              <dd>
                Fakta listing ·{" "}
                {item?.listing.updatedAt
                  ? new Date(item.listing.updatedAt).toLocaleDateString("id-ID")
                  : "—"}
                . Klaim dokumen belum digunakan.
              </dd>
            </dl>
          </Card>
          <Card id="builder-2" title="▧ Creative Plan">
            <div className={s.concepts}>
              {strategy?.variants.map((v) => (
                <div key={v.angle}>
                  <span>✧</span>
                  <b>{v.angle}</b>
                  <small>Image 4:5 · Planned</small>
                </div>
              ))}
            </div>
            <p>
              {kaiError
                ? "Kai belum tersedia"
                : packages === undefined
                  ? "Memuat paket Kai…"
                  : `${available.length} paket terkait ditemukan`}
            </p>
            {available.map((p) => (
              <p key={p.id}>
                <Link href={"/kai-studio?package=" + encodeURIComponent(p.id)}>
                  {p.title} · {p.status} →
                </Link>
              </p>
            ))}
            <button
              disabled={!canSave || !period.valid || saving || !!error}
              onClick={() => void save(true)}
            >
              {saving ? "Menyimpan brief…" : "Simpan & Buka Kai Studio →"}
            </button>
            {handoff?.status === "NEEDS_INPUT" && (
              <p role="status">Brief perlu dilengkapi: {handoff.missingFields?.join(", ")}</p>
            )}
            <small>Pengiriman structured brief dan shortlist masuk tahap kedua.</small>
          </Card>
        </div>
        <div className={s.column}>
          <Card title="▤ Live Campaign Summary">
            <span className={s.badge}>Draft · belum diterbitkan</span>
            <label>
              Campaign Name
              <input
                maxLength={200}
                value={generatedName}
                onChange={(e) => {
                  setName(e.target.value);
                  setSaved("");
                }}
              />
            </label>
            <dl>
              <dt>Goal</dt>
              <dd>{goal}</dd>
              <dt>Budget</dt>
              <dd>{budget ? money(budget) + "/hari" : "Belum diisi"}</dd>
              <dt>Total</dt>
              <dd>{period.valid ? money(period.total) : "Periode/budget belum valid"}</dd>
              <dt>Schedule</dt>
              <dd>
                {start || "—"} → {end || "—"}
              </dd>
              <dt>Listing</dt>
              <dd>{item?.listing.title ?? "Belum dipilih"}</dd>
              <dt>Meta Account</dt>
              <dd>{meta?.adAccountId ?? (metaError ? "Koneksi gagal dimuat" : "Memuat akun…")}</dd>
              <dt>Page</dt>
              <dd>
                {meta?.pages.map((p) => p.name).join(", ") || "Belum tersedia"}
                <small> · belum dipilih untuk campaign</small>
              </dd>
              <dt>Meta status</dt>
              <dd>{meta?.warning ?? "Eligibility belum diperiksa"}</dd>
              <dt>Automation</dt>
              <dd>Policy belum diperiksa</dd>
            </dl>
          </Card>
          <Card title="Meta Page & WhatsApp">
            <MetaLeadDestination
              pageId={destination.pageId}
              number={destination.number}
              onChange={(pageId, adAccountId, number) => {
                setDestination({ pageId, adAccountId, number });
                setSaved("");
              }}
            />
          </Card>
          <Card title="◉ Ad Preview">
            <small>Facebook Feed · ilustrasi layout, belum preview Meta</small>
            <div className={s.preview}>
              <b>
                {meta?.pages.find((p) => p.id === destination.pageId)?.name ?? "Page belum dipilih"}
              </b>
              <small>Sponsored · Draft</small>
              <p>{copy?.primaryText ?? "Copy muncul setelah listing dipilih."}</p>
              {item?.images[0] ? (
                <img src={item.images[0]} alt="Foto listing untuk preview draft" />
              ) : (
                <div className={s.placeholder}>Foto listing belum tersedia</div>
              )}
              <div className={s.previewBottom}>
                <strong>{copy?.headline ?? "Headline"}</strong>
                <p>{copy?.description}</p>
                <span>
                  {goal === "WhatsApp Leads" ? "Chat di WhatsApp" : "Pelajari Selengkapnya"}
                </span>
              </div>
            </div>
            <small>Foto sumber listing; belum creative Kai yang lolos QA.</small>
          </Card>
          <Card id="builder-3" title="☷ Preflight Checklist">
            <ul className={s.checks}>
              {[
                [
                  "Listing",
                  item?.readiness.ready ? "Data lengkap" : "Blocking · data belum lengkap",
                ],
                [
                  "Budget & Schedule",
                  period.valid ? "Valid secara lokal" : "Blocking · lengkapi budget/periode",
                ],
                [
                  "Existing Campaign",
                  active.length
                    ? "Warning · campaign aktif ada"
                    : inventory?.campaigns
                      ? "Tidak ditemukan hubungan aktif"
                      : "Not checked",
                ],
                ["Meta Account / Page", "Not checked"],
                ["Destination / Tracking", "Not checked"],
                ["Creative Supply / QA", "Not checked"],
                ["Copy / Policy / Housing", "Not checked"],
                ["Automation Guardrail", "Not checked"],
              ].map(([label, status]) => (
                <li key={label}>
                  <span>{label}</span>
                  <small>{status}</small>
                </li>
              ))}
            </ul>
            <p id="builder-4" className={s.warning}>
              Publish diblokir sampai preflight server lengkap. Checklist lokal tidak memberi izin
              launch.
            </p>
            <div className={s.actions}>
              <button
                disabled={!canSave || !period.valid || saving || !!error}
                onClick={() => void save()}
              >
                {saving ? "Menyimpan…" : "▣ Save Draft"}
              </button>
              <button disabled title="Preflight dan eksekusi lengkap belum tersedia">
                Create Campaign
              </button>
            </div>
            <p role="status">{saved}</p>
          </Card>
        </div>
      </div>
    </main>
  );
}
