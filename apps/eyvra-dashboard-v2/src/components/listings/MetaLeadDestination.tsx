"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./ListingEditor.module.css";
type WhatsAppNumber = {
  phoneNumberId: string;
  displayNumber: string;
  wabaId: string;
  wabaName: string;
  qualityRating?: string;
};
type Assets = {
  adAccountId: string;
  warning?: string;
  pages: { id: string; name: string }[];
  whatsappNumbers: WhatsAppNumber[];
};
export function MetaLeadDestination({
  pageId,
  number,
  onChange,
}: {
  pageId: string;
  number: string;
  onChange: (pageId: string, accountId: string, number: string) => void;
}) {
  const [assets, setAssets] = useState<Assets>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch("/api/listing-editor/listings/lead-destinations")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Tujuan Meta belum tersedia.");
        if (
          !Array.isArray(data.pages) ||
          !Array.isArray(data.whatsappNumbers) ||
          typeof data.adAccountId !== "string"
        )
          throw new Error("Daftar aset Meta belum tersedia.");
        if (!cancelled) setAssets(data);
      })
      .catch((e) => {
        if (!cancelled) {
          setAssets(undefined);
          setError(e.message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [revision]);
  const page = assets?.pages.find((p) => p.id === pageId);
  return (
    <>
      <p>Pilih Facebook Page dan WhatsApp Business dari akun iklan Meta yang terhubung.</p>
      {loading && <p role="status">Memuat aset Meta…</p>}
      {error && <p role="alert">{error}</p>}
      {assets?.warning && <p role="alert">{assets.warning}</p>}
      {assets && (
        <div className={styles.form}>
          <label>
            Akun Iklan Meta
            <input readOnly value={assets.adAccountId} />
          </label>
          <label>
            Facebook Page
            <select
              aria-label="Facebook Page"
              disabled={loading}
              value={pageId}
              onChange={(event) => {
                const selected = assets.pages.find((p) => p.id === event.target.value);
                // Page and WhatsApp number are two independent choices from the same ad account/
                // Business — Meta does not require a Page to be pre-linked to a specific WhatsApp
                // number (see MetaLeadDestinationsService's class doc). Changing the Page keeps
                // whatever WhatsApp number is already chosen; clearing the Page clears both.
                onChange(
                  selected?.id ?? "",
                  selected ? assets.adAccountId : "",
                  selected ? number : "",
                );
              }}
            >
              <option value="">Pilih Page</option>
              {pageId && !page && (
                <option value={pageId}>Page tersimpan tidak tersedia — pilih ulang</option>
              )}
              {assets.pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.id}
                </option>
              ))}
            </select>
          </label>
          <label>
            WhatsApp Business Tujuan
            <select
              aria-label="WhatsApp Business Tujuan"
              value={number}
              disabled={loading || assets.whatsappNumbers.length === 0}
              onChange={(event) => onChange(pageId, assets.adAccountId, event.target.value)}
            >
              <option value="">Pilih nomor WhatsApp</option>
              {assets.whatsappNumbers.map((w) => (
                <option key={w.phoneNumberId} value={w.displayNumber}>
                  {w.displayNumber} · {w.wabaName}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {assets?.pages.length === 0 && (
        <p>Belum ada Page yang dapat digunakan oleh akun iklan ini.</p>
      )}
      {assets && assets.whatsappNumbers.length === 0 && (
        <p>
          Belum ada nomor WhatsApp Business terverifikasi yang dapat dibaca dari Meta Business
          Manager akun iklan ini.
        </p>
      )}
      {number && !pageId && (
        <p>Nomor lama: {number}. Pilih Page dan nomor dari Meta untuk memverifikasi tujuan CTWA.</p>
      )}
      <p>Tujuan diperiksa kembali saat disimpan. Pemilihan ini belum menerbitkan iklan.</p>
      <button type="button" disabled={loading} onClick={() => setRevision((r) => r + 1)}>
        Muat ulang aset Meta
      </button>{" "}
      <Link href="/settings">Pengaturan koneksi Meta</Link>
    </>
  );
}
