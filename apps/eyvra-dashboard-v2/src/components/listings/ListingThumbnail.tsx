"use client";
import { useState } from "react";
import styles from "./Listings.module.css";
export function ListingThumbnail({
  urls,
  title,
  count,
}: {
  urls: string[];
  title: string;
  count?: number;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const src = urls.find((url) => !failed.includes(url));
  return (
    <div className={styles.thumbnail}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- persisted listing assets with failure fallback
        <img
          src={src}
          alt={title}
          loading="lazy"
          onError={() => setFailed((previous) => [...previous, src])}
        />
      ) : (
        <div className={styles.noImage}>
          <span>▧</span>
          <small>Foto belum tersedia</small>
        </div>
      )}
      {count !== undefined && count > 0 && <span className={styles.photoCount}>▧ {count}</span>}
    </div>
  );
}
