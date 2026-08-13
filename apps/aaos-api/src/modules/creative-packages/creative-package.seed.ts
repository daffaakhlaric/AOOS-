import type { StoredCreativePackage } from "./creative-package.store.js";

/**
 * Fixture data for `CreativePackageStore.seed()` — see that class's doc for why this exists (no
 * upstream pipeline lands real packages here yet). Shapes mirror the dashboard spec's ASCII
 * mockup (`docs/PROMPT-AAOS-W4A-DASHBOARD.md` §4 "Creative Review") closely enough for real UI
 * testing, but the content itself is illustrative, not production data.
 */
export const CREATIVE_PACKAGE_SEED: readonly StoredCreativePackage[] = [
  {
    id: "KAI-001",
    briefId: "A003",
    branch: "BINTARO",
    unit: "Xpander",
    title: "Xpander Bintaro · DP Ringan",
    videoUrl: "https://cdn.example.com/kai/KAI-001/video.mp4",
    imageUrls: [
      "https://cdn.example.com/kai/KAI-001/image-1.jpg",
      "https://cdn.example.com/kai/KAI-001/image-2.jpg",
      "https://cdn.example.com/kai/KAI-001/image-3.jpg",
    ],
    copyVariants: [
      {
        id: "KAI-001-A",
        variantLabel: "A",
        primaryText: "Xpander 2019 DP 29 juta bawa pulang, cicilan ringan mulai 3 jutaan.",
        headline: "DP Ringan, Bawa Pulang Hari Ini",
        callToAction: "Hubungi Sekarang",
      },
      {
        id: "KAI-001-B",
        variantLabel: "B",
        primaryText: "Keluarga makin nyaman dengan Xpander — kabin lega, irit BBM.",
        headline: "Nyaman Sekeluarga",
        callToAction: "Pelajari Lebih Lanjut",
      },
      {
        id: "KAI-001-C",
        variantLabel: "C",
        primaryText: "Diinspeksi 150+ titik, DP 29 juta, unit siap kirim minggu ini.",
        headline: "150+ Titik Inspeksi",
        callToAction: "Hubungi Sekarang",
      },
    ],
    status: "PENDING",
    createdAt: "2026-08-09T02:00:00.000Z",
  },
  {
    id: "KAI-002",
    briefId: "A007",
    branch: "CINERE",
    unit: "Brio",
    title: "Brio Cinere · Promo Agustus",
    videoUrl: "https://cdn.example.com/kai/KAI-002/video.mp4",
    imageUrls: [
      "https://cdn.example.com/kai/KAI-002/image-1.jpg",
      "https://cdn.example.com/kai/KAI-002/image-2.jpg",
      "https://cdn.example.com/kai/KAI-002/image-3.jpg",
    ],
    copyVariants: [
      {
        id: "KAI-002-A",
        variantLabel: "A",
        primaryText: "Brio irit, lincah, cocok buat harian. Promo Agustus DP mulai 15 juta.",
        headline: "Promo Agustus DP 15 Juta",
        callToAction: "Hubungi Sekarang",
      },
      {
        id: "KAI-002-B",
        variantLabel: "B",
        primaryText: "Mobil pertama yang pas — Brio bergaransi resmi, siap pakai.",
        headline: "Mobil Pertama yang Pas",
        callToAction: "Daftar Sekarang",
      },
      {
        id: "KAI-002-C",
        variantLabel: "C",
        primaryText: "Stok terbatas — Brio bergaransi, unit terawat, siap test drive.",
        headline: "Stok Terbatas",
        callToAction: "Pelajari Lebih Lanjut",
      },
    ],
    status: "PENDING",
    createdAt: "2026-08-10T05:30:00.000Z",
  },
];
