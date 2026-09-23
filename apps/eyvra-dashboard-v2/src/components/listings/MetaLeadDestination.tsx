"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./ListingEditor.module.css";
type Assets = {
  adAccountId: string;
  warning?: string;
  pages: { id: string; name: string; whatsappNumber: string | null }[];
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
        if (!Array.isArray(data.pages) || typeof data.adAccountId !== "string")
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
                onChange(selected?.id ?? "", selected ? assets.adAccountId : "", "");
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
              disabled={loading || !page?.whatsappNumber}
              onChange={(event) => onChange(pageId, assets.adAccountId, event.target.value)}
            >
              <option value="">Pilih nomor WhatsApp</option>
              {page?.whatsappNumber && (
                <option value={page.whatsappNumber}>{page.whatsappNumber}</option>
              )}
            </select>
          </label>
        </div>
      )}
      {assets?.pages.length === 0 && (
        <p>Belum ada Page yang dapat digunakan oleh akun iklan ini.</p>
      )}
      {page && !page.whatsappNumber && (
        <p>
          Page ini belum memiliki nomor WhatsApp Business yang dapat dibaca dari Meta. Hubungkan
          nomor ke Page dan periksa izin aset.
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
