import type { ListingItem } from "./listings";

/** Reviewable rule-based Samantha draft; never an approved or published campaign. */
export function draftListingStrategy(item: ListingItem) {
  const l = item.listing;
  const location = [l.kecamatan, l.city].filter(Boolean).join(", ");
  const name = [item.type, location && `di ${location}`].filter(Boolean).join(" ");
  const price =
    l.price > 0
      ? new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "IDR",
          maximumFractionDigits: 0,
        }).format(l.price)
      : "";
  const specs = [
    l.landArea && `Tanah ${l.landArea} m²`,
    l.propertyType !== "TANAH" && l.buildArea && `bangunan ${l.buildArea} m²`,
    l.propertyType !== "TANAH" && l.bedrooms && `${l.bedrooms} kamar tidur`,
    l.certificate,
  ]
    .filter(Boolean)
    .join(" · ");
  const cta = l.waNumber
    ? "Hubungi melalui WhatsApp untuk informasi dan jadwal survei."
    : "Minta informasi lengkap dan jadwal survei.";
  const angles = [
    "Lokasi",
    "Spesifikasi",
    "Harga transparan",
    "Eksplorasi properti",
    "Jadwal survei",
  ];
  const openings = [
    location
      ? `Mencari ${item.type.toLowerCase()} di ${location}?`
      : `Kenali ${item.type.toLowerCase()} ini.`,
    specs
      ? `Pertimbangkan kebutuhan ruang Anda: ${specs}.`
      : `Kenali detail ${item.type.toLowerCase()} ini.`,
    price
      ? `Rencanakan pembelian properti dengan harga listing ${price}.`
      : "Dapatkan informasi harga langsung dari tim listing.",
    `Lihat foto dan detail ${name} sebelum menentukan pilihan.`,
    `Ingin melihat ${name} secara langsung?`,
  ];
  return {
    audience: {
      age: "18–65+ · semua usia dewasa; validasi batas akun/kategori Meta",
      radiusKm: l.price >= 3000000000 ? 25 : l.price >= 1000000000 ? 15 : 10,
      center: location || l.province || "",
      behavior:
        "Prospecting broad tanpa filter behavior. Usulan retargeting: pengunjung listing, penonton video, dan interaksi Page/Instagram; memerlukan sumber event dan Custom Audience yang tersedia.",
      rationale:
        l.price > 0
          ? "Hipotesis awal radius berdasarkan harga: di bawah Rp1 M → 10 km; Rp1–3 M → 15 km; mulai Rp3 M → 25 km. Uji terhadap kualitas lead; bukan benchmark pasar atau estimasi daya beli."
          : "Harga belum diisi: radius eksplorasi awal 10 km. Lengkapi harga untuk meninjau rekomendasi.",
      validation:
        "Pin/koordinat belum diverifikasi. Interest berasal dari katalog tersimpan; belum diperiksa ulang terhadap akun saat ini. Validasi opsi dan minimum radius berdasarkan negara, akun, serta kategori Housing sebelum diterapkan.",
    },
    objective: "Qualified Leads",
    rationale: `Fokus pada calon peminat yang sesuai dengan lokasi, spesifikasi, dan harga ${item.type.toLowerCase()}; lanjutkan ke percakapan dan survei. Target volume, periode, dan budget menunggu data biaya serta persetujuan.`,
    structure: "1 Campaign · 1 Primary Ad Set · uji 3 creative",
    direction: `${l.photos.length ? "Siapkan" : "Tambahkan foto asli lalu siapkan"} 5 konsep: ${angles.join(", ")}. Shortlist 3 untuk pengujian awal. Image 4:5 dan 1:1; storyboard video 9:16 jika footage tersedia.`,
    variants: angles.map((angle, index) => ({
      angle,
      primaryText: [
        openings[index],
        l.title,
        location && `Lokasi: ${location}.`,
        price && `Harga listing ${price}.`,
        specs,
        cta,
      ]
        .filter(Boolean)
        .join(" "),
      headline: [
        name,
        `${item.type}: lihat spesifikasinya`,
        price ? `${item.type} · ${price}` : `Informasi ${item.type}`,
        `Jelajahi ${name}`,
        `Jadwalkan survei ${item.type.toLowerCase()}`,
      ][index]!,
      description: [
        location ? `Informasi listing di ${location}.` : "Informasi sesuai listing.",
        specs || "Tanyakan spesifikasi lengkap.",
        "Konfirmasi harga dan ketersediaan terkini.",
        "Lihat foto asli dan tanyakan detailnya.",
        "Hubungi tim untuk menentukan jadwal.",
      ][index]!,
    })),
  };
}
