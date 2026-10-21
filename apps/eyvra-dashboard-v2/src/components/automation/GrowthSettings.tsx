"use client";
import { useEffect, useState } from "react";
import s from "./GrowthSettings.module.css";
type Value = string | number | boolean | null;
type Policy = Record<string, Value | Record<string, Value | Record<string, Value>>>;
type View = {
  version: number;
  policy: Policy;
  defaults: Policy;
  canEdit: boolean;
  updatedAt: string | null;
  readiness: {
    ready: boolean;
    status?: string;
    blockers: string[];
    warnings?: string[];
    actions?: {
      key: string;
      label: string;
      available: boolean;
      reason: string;
      href: string;
      execution: string;
    }[];
  };
  estimate: { status: string; reason: string };
  paceProfiles: Record<
    string,
    { scalePercent: number; cooldownHours: number; reviewHours: number }
  >;
};
const tabs = [
  "Strategi Pertumbuhan",
  "Budget & Bidding",
  "Creative & Content",
  "Audience & Targeting",
  "Lead & Conversion",
  "Safety & Guardrail",
];
const goals = [
  ["QUALIFIED_LEADS", "Leads Berkualitas", "Fokus pada calon pelanggan yang relevan."],
  ["LEAD_VOLUME", "Volume Leads", "Tingkatkan jumlah lead dengan biaya efisien."],
  ["SALES_CONVERSION", "Penjualan / Konversi", "Optimalkan perjalanan menuju transaksi."],
  ["BRAND_AWARENESS", "Brand Awareness", "Tingkatkan jangkauan dan kesadaran."],
];
const paceNames = ["Konservatif", "Moderate", "Agresif", "Maksimal"];
const paceKeys = ["CONSERVATIVE", "MODERATE", "AGGRESSIVE", "MAX_GROWTH"];
export function GrowthSettings() {
  const [view, setView] = useState<View | null>(null),
    [draft, setDraft] = useState<Policy | null>(null),
    [tab, setTab] = useState(0),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [notice, setNotice] = useState("");
  const dirty = !!view && JSON.stringify(draft) !== JSON.stringify(view.policy);
  async function load() {
    setError("");
    try {
      const r = await fetch("/api/automation/growth-policy", { cache: "no-store" });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      setView(b);
      setDraft(b.policy);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat pengaturan.");
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    const click = (e: MouseEvent) => {
      if (
        dirty &&
        (e.target as HTMLElement).closest("a[href]") &&
        !window.confirm("Perubahan belum disimpan. Tinggalkan halaman?")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", click, true);
    };
  }, [dirty]);
  function get(path: string): Value {
    let value: unknown = draft;
    for (const k of path.split(".")) value = (value as Record<string, unknown>)?.[k];
    return value as Value;
  }
  function set(path: string, value: Value) {
    setDraft((p) => {
      const next = JSON.parse(JSON.stringify(p)) as Policy;
      const keys = path.split(".");
      let parent = next as Record<string, unknown>;
      for (const k of keys.slice(0, -1)) parent = parent[k] as Record<string, unknown>;
      parent[keys[keys.length - 1]!] = value;
      return next;
    });
    setNotice("");
  }
  async function save(policy = draft, reason = "Updated from Growth Settings") {
    if (!view || !policy) return;
    setSaving(true);
    setError("");
    try {
      const r = await fetch("/api/automation/growth-policy", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedVersion: view.version, policy, reason }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      setView(b);
      setDraft(b.policy);
      setNotice("Tersimpan. Samantha akan menilai ulang menggunakan versi terbaru.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }
  const field = (path: string, label: string, unit = "", step = "1") => (
    <label className={s.field} key={path}>
      <span>{label}</span>
      <div>
        <input
          aria-label={label}
          type="number"
          min="0"
          step={step}
          value={get(path) === null ? "" : String(get(path))}
          onChange={(e) => set(path, e.target.value === "" ? null : Number(e.target.value))}
        />
        {unit && <small>{unit}</small>}
      </div>
    </label>
  );
  const toggle = (path: string, label: string, locked = false) => (
    <label className={s.toggle} key={path}>
      <input
        type="checkbox"
        checked={get(path) === true}
        disabled={locked}
        onChange={(e) => set(path, e.target.checked)}
      />
      <span>
        {label}
        {locked && <small>Wajib untuk publikasi otomatis</small>}
      </span>
    </label>
  );
  const select = (path: string, label: string, options: string[]) => (
    <label className={s.field} key={path}>
      <span>{label}</span>
      <select value={String(get(path))} onChange={(e) => set(path, e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
  const card = (title: string, description: string, children: React.ReactNode) => (
    <section className={s.card}>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      <div className={s.fields}>{children}</div>
    </section>
  );
  if (!view || !draft)
    return (
      <main className={s.page}>
        <h1>Growth Settings</h1>
        <p role={error ? "alert" : "status"}>{error || "Memuat kebijakan pertumbuhan…"}</p>
        {error && <button onClick={() => void load()}>Coba lagi</button>}
      </main>
    );
  const pace = view.paceProfiles[String(draft.pace)];
  return (
    <main className={s.page}>
      <div className={s.breadcrumb}>
        Automation　›　Autonomous Loop　›　<strong>Growth Settings</strong>
      </div>
      <header className={s.header}>
        <div>
          <h1>
            <span>↗</span> Growth Settings
          </h1>
          <p>
            Atur strategi pertumbuhan, batasan, dan preferensi Samantha sesuai tujuan bisnis Anda.
          </p>
        </div>
        <button
          disabled={!view.canEdit || saving}
          onClick={() => {
            if (
              window.confirm(
                "Reset ke default aman? Riwayat tetap disimpan dan versi baru akan dibuat.",
              )
            )
              void save(view.defaults, "Reset to safe defaults");
          }}
        >
          ↻ Reset ke Default
        </button>
      </header>
      {error && (
        <div className={s.error} role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className={s.notice} role="status">
          {notice}
        </div>
      )}
      <div className={s.layout}>
        <div>
          <nav className={s.tabs} aria-label="Growth Settings">
            {tabs.map((t, i) => (
              <button key={t} aria-pressed={tab === i} onClick={() => setTab(i)}>
                {t}
              </button>
            ))}
          </nav>
          <fieldset disabled={!view.canEdit || saving} className={s.editor}>
            {tab === 0 && (
              <>
                <section className={s.card}>
                  <h2>◎ Tujuan Pertumbuhan</h2>
                  <p>
                    Tentukan hasil yang ingin Anda capai. Target adalah acuan perencanaan, bukan
                    jaminan hasil.
                  </p>
                  <div className={s.goals}>
                    {goals.map(([key, label, desc]) => (
                      <button
                        key={key}
                        className={get("growthObjective") === key ? s.selected : ""}
                        onClick={() => set("growthObjective", key!)}
                      >
                        <strong>{label}</strong>
                        <span>{desc}</span>
                      </button>
                    ))}
                  </div>
                </section>
                <div className={s.grid}>
                  {card(
                    "Target Pertumbuhan",
                    "Tetapkan target dalam periode yang Anda pilih.",
                    <>
                      {field("targets.monthlyLeads", "Target leads / bulan", "leads")}
                      {field("targets.costPerOutcome", "Target biaya per outcome", "Rp")}
                      {field("targets.roas", "Target ROAS (opsional)", "x", "0.1")}
                      {field("targets.monthlySales", "Target penjualan / booking", "unit")}
                    </>,
                  )}
                  {card(
                    "Timeline & Pace",
                    "Kecepatan pertumbuhan tetap dibatasi pengaman.",
                    <>
                      {field("targetWindowDays", "Periode", "hari")}
                      <div className={s.pace}>
                        <label htmlFor="growth-pace">Kecepatan Pertumbuhan</label>
                        <input
                          id="growth-pace"
                          type="range"
                          min="0"
                          max="3"
                          value={paceKeys.indexOf(String(draft.pace))}
                          onChange={(e) => set("pace", paceKeys[Number(e.target.value)]!)}
                        />
                        <div>
                          {paceNames.map((p) => (
                            <small key={p}>{p}</small>
                          ))}
                        </div>
                        <p>
                          Preferensi langkah +{pace?.scalePercent}%, jeda {pace?.cooldownHours} jam.
                          Batas workspace yang lebih ketat selalu berlaku.
                        </p>
                      </div>
                    </>,
                  )}
                  {card(
                    "Strategi Scaling Otomatis",
                    "Tetap memerlukan bukti dan izin setiap tindakan.",
                    <>
                      {toggle("budgetPolicy.autoScaleEnabled", "Scale budget otomatis")}
                      {toggle("budgetPolicy.autoReduceEnabled", "Kurangi budget otomatis")}
                      {toggle("creativePolicy.autoWinnerExpansion", "Kembangkan creative pemenang")}
                    </>,
                  )}
                  {card(
                    "Kondisi Scaling",
                    "Tidak menilai keberhasilan hanya dari CPL murah.",
                    <>
                      {field(
                        "budgetPolicy.maximumCostPerOutcome",
                        "Biaya maksimum per outcome",
                        "Rp",
                      )}
                      {field("budgetPolicy.minimumLeads", "Minimum leads", "leads")}
                      {field("budgetPolicy.minimumObservationHours", "Periode observasi", "jam")}
                    </>,
                  )}
                </div>
              </>
            )}
            {tab === 1 && (
              <div className={s.grid}>
                {card(
                  "Budget Growth",
                  "Batas wajib sebelum otomatisasi diaktifkan.",
                  <>
                    {field("budgetPolicy.dailyBudgetFloor", "Budget minimum / hari", "Rp")}
                    {field(
                      "budgetPolicy.dailyBudgetCeiling",
                      "Budget maksimum campaign / hari",
                      "Rp",
                    )}
                    {field("budgetPolicy.accountDailySpendCap", "Batas belanja akun / hari", "Rp")}
                    {field("budgetPolicy.monthlySpendCap", "Batas belanja / bulan", "Rp")}
                  </>,
                )}
                {card(
                  "Scaling & Pacing",
                  "Perubahan budget menggunakan batas absolut.",
                  <>
                    {field(
                      "budgetPolicy.maxScalePercentPerAction",
                      "Kenaikan maksimum per aksi",
                      "%",
                    )}
                    {field(
                      "budgetPolicy.maxReductionPercentPerAction",
                      "Penurunan maksimum per aksi",
                      "%",
                    )}
                    {field("budgetPolicy.scaleCooldownHours", "Jeda scaling", "jam")}
                    {field("budgetPolicy.reductionCooldownHours", "Jeda penurunan", "jam")}
                    {select("budgetPolicy.reallocation", "Realokasi portfolio", [
                      "OFF",
                      "RECOMMEND_ONLY",
                    ])}
                  </>,
                )}
              </div>
            )}
            {tab === 2 && (
              <div className={s.grid}>
                {card(
                  "Creative & Content",
                  "Preferensi produksi dan kapasitas Kai.",
                  <>
                    {toggle("creativePolicy.autoCreativeRefresh", "Minta creative refresh")}
                    {toggle("creativePolicy.autoWinnerExpansion", "Kembangkan winning traits")}
                    {toggle("creativePolicy.autoGenerateVariants", "Buat variasi konsep")}
                    {select("creativePolicy.quality", "Target kualitas", [
                      "PERFORMANCE",
                      "BALANCED",
                      "PREMIUM",
                      "SOCIAL_NATIVE",
                    ])}
                    {field("creativePolicy.explorationRate", "Rasio eksplorasi (0–1)", "", "0.05")}
                    {field("creativePolicy.refreshCooldownHours", "Jeda refresh", "jam")}
                  </>,
                )}
                {card(
                  "Kapasitas & Format",
                  "Aset pengganti harus siap sebelum creative terakhir dipause.",
                  <>
                    {field("creativePolicy.minimumActiveCreatives", "Minimum creative aktif")}
                    {field("creativePolicy.targetCreativeCapacity", "Target kapasitas")}
                    {field(
                      "creativePolicy.maxCreativeChangesPerWindow",
                      "Maksimum perubahan per periode",
                    )}
                    {toggle("creativePolicy.allowImage", "Image")}
                    {toggle("creativePolicy.allowVideo", "Video")}
                    {toggle("creativePolicy.allowCarousel", "Carousel")}
                    {field("creativePolicy.preferredDurationSeconds", "Durasi video", "detik")}
                    {toggle("creativePolicy.allowVoiceover", "Voiceover")}
                    {toggle("creativePolicy.allowAiScenes", "Scene AI")}
                    {toggle("creativePolicy.qaRequired", "QA diperlukan", true)}
                    {toggle("creativePolicy.simulationRequired", "Simulation diperlukan", true)}
                  </>,
                )}
              </div>
            )}
            {tab === 3 &&
              card(
                "Audience & Targeting",
                "Perluasan memerlukan bukti kualitas serta pemeriksaan learning dan tracking.",
                <>
                  {select("audiencePolicy.mode", "Mode audience", [
                    "OFF",
                    "RECOMMEND",
                    "EXPERIMENT_FIRST",
                  ])}
                  {field("audiencePolicy.maximumGeoExpansionKm", "Batas perluasan lokasi", "km")}
                  {field("audiencePolicy.cooldownHours", "Jeda perubahan", "jam")}
                  {field("audiencePolicy.minimumQuality", "Kualitas minimum (0–1)", "", "0.05")}
                  <p>
                    Eksekusi audience otomatis belum tersedia. Preferensi akan dipakai sebagai batas
                    saat integrasi siap.
                  </p>
                </>,
              )}
            {tab === 4 &&
              card(
                "Lead & Conversion",
                "Pilih outcome bisnis; data yang belum tersedia tetap ditandai tidak diketahui.",
                <>
                  {select("optimizationBasis", "Dasar optimasi tanpa / dengan CRM", [
                    "META_LEAD",
                    "BUSINESS_OUTCOME",
                  ])}
                  {select("conversionPolicy.primaryMetric", "Metrik sukses utama", [
                    "LEAD",
                    "QUALIFIED_LEAD",
                    "HOT_LEAD",
                    "APPOINTMENT",
                    "BOOKING",
                    "PURCHASE",
                    "REVENUE",
                    "ROAS",
                  ])}
                  {field(
                    "conversionPolicy.minimumQualifiedRate",
                    "Qualified rate minimum (0–1)",
                    "",
                    "0.05",
                  )}
                  {field(
                    "conversionPolicy.minimumHotLeadRate",
                    "Hot lead rate minimum (0–1)",
                    "",
                    "0.05",
                  )}
                  {field("conversionPolicy.maximumCrmAgeHours", "Usia maksimum data CRM", "jam")}
                  {toggle("conversionPolicy.flagSalesIssues", "Tandai kendala proses sales")}
                  {toggle(
                    "conversionPolicy.useFirstMessageIntelligence",
                    "Gunakan First Message Intelligence",
                  )}
                </>,
              )}
            {tab === 5 && (
              <>
                {card(
                  "Safety & Guardrail",
                  "Mode tidak dapat melampaui batas keselamatan sistem.",
                  <>
                    {select("autonomousMode", "Mode otomatisasi", [
                      "ADVISOR",
                      "COPILOT",
                      "AUTOPILOT_GUARDED",
                      "AUTONOMOUS",
                    ])}
                    {toggle("safetyPolicy.killSwitch", "Hentikan seluruh aksi otomatis")}
                    {field(
                      "safetyPolicy.minimumConfidence",
                      "Confidence minimum (0–1)",
                      "",
                      "0.05",
                    )}
                    {field(
                      "safetyPolicy.maxAutoPublishedPerDay",
                      "Batas publikasi otomatis / hari",
                    )}
                    {toggle(
                      "safetyPolicy.neverPauseFinalCreative",
                      "Lindungi creative terakhir",
                      true,
                    )}
                    {toggle(
                      "safetyPolicy.newCampaignsStartPaused",
                      "Campaign baru dimulai paused",
                      true,
                    )}
                    {toggle("safetyPolicy.claimVerificationRequired", "Verifikasi klaim", true)}
                  </>,
                )}
                {card(
                  "Izin per Tindakan",
                  "AUTO tetap harus lolos readiness, data, dan pengaman.",
                  <>
                    {Object.keys(
                      get("safetyPolicy.permissions") as unknown as Record<string, string>,
                    ).map((a) =>
                      select(`safetyPolicy.permissions.${a}`, a.replaceAll("_", " "), [
                        "AUTO",
                        "APPROVAL_REQUIRED",
                        "DISABLED",
                      ]),
                    )}
                    {toggle("safetyPolicy.useHistoricalLearning", "Gunakan riwayat pembelajaran")}
                    {toggle(
                      "safetyPolicy.useExperimentLearning",
                      "Gunakan pembelajaran eksperimen",
                    )}
                  </>,
                )}
              </>
            )}
          </fieldset>
        </div>
        <aside className={s.rail}>
          <section className={s.card}>
            <h2>▣ Ringkasan Strategi</h2>
            <p>
              Versi tersimpan v{view.version}
              {dirty ? " · Perubahan belum disimpan" : ""}
            </p>
            <dl>
              {[
                ["Tujuan", goals.find((g) => g[0] === draft.growthObjective)?.[1]],
                ["Target leads", get("targets.monthlyLeads") ?? "Belum diatur"],
                [
                  "Target biaya",
                  get("targets.costPerOutcome") === null
                    ? "Belum diatur"
                    : `Rp ${Number(get("targets.costPerOutcome")).toLocaleString("id-ID")}`,
                ],
                ["Kecepatan", paceNames[paceKeys.indexOf(String(draft.pace))]],
                ["Periode", `${draft.targetWindowDays} hari`],
                ["Mode", draft.autonomousMode],
              ].map(([a, b]) => (
                <div key={String(a)}>
                  <dt>{String(a)}</dt>
                  <dd>{String(b)}</dd>
                </div>
              ))}
            </dl>
            <button
              className={s.primary}
              disabled={!view.canEdit || saving || !dirty}
              onClick={() => void save()}
            >
              {saving ? "Menyimpan…" : "▣ Simpan Perubahan"}
            </button>
            {!view.canEdit && <p>Akses hanya-baca.</p>}
          </section>
          <section className={`${s.card} ${s.estimate}`}>
            <h2>Perkiraan Hasil</h2>
            <p>{view.estimate.reason}</p>
            <small>Estimasi bukan jaminan. Angka hanya ditampilkan jika didukung data.</small>
          </section>
          <section className={s.card}>
            <h2>
              Kesiapan per Aksi{" "}
              <span className={s.badge}>
                {view.readiness.status === "PARTIAL" ? "Siap sebagian" : "Perlu konfigurasi"}
              </span>
            </h2>
            <p>CRM opsional untuk analisis, campaign, approval, dan produksi creative.</p>
            {view.readiness.actions?.map((a) => (
              <div key={a.key}>
                <strong>
                  {a.available ? "✓" : "○"} {a.label}
                </strong>
                <p>{a.reason}</p>
                {a.available && <a href={a.href}>Buka →</a>}
              </div>
            ))}
            {view.readiness.warnings?.map((w) => (
              <p key={w}>{w}</p>
            ))}
            {view.readiness.blockers.map((b) => (
              <p key={b}>○ {b}</p>
            ))}
            <button onClick={() => setTab(5)}>Periksa pengaman →</button>
          </section>
        </aside>
      </div>
    </main>
  );
}
