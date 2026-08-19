"use client";

import { useState } from "react";

import {
  LISTING_STATUSES,
  PROPERTY_TYPES,
  type CreateListingInput,
  type ListingDto,
  type ListingStatus,
  type PhotoDto,
  type PropertyType,
  type UpdateListingInput,
} from "@/types/listing.types";

import styles from "./ListingModal.module.css";

export interface ListingModalProps {
  /** `undefined` = Add mode (`POST /api/listings`); a real listing = Edit mode (`PUT /api/listings/:id`). */
  readonly editing?: ListingDto;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}

async function parseError(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
  return body.error?.message ?? fallback;
}

/**
 * "+ Tambah Listing" / a card's "[Edit]" modal (spec Part 4). Sections: INFORMASI DASAR,
 * SPESIFIKASI, LOKASI, DESKRIPSI & KEUNGGULAN, FOTO PROPERTI, NOMOR WA AGEN.
 *
 * DEVIATION FROM SPEC (documented): the spec's photo section describes free drag-to-reorder;
 * this implementation uses explicit "▲"/"▼" reorder buttons instead of HTML5 drag-and-drop —
 * same end capability (any two photos can be reordered, and any photo set as main), simpler and
 * more accessible than a bespoke drag implementation, and it calls the exact same real
 * `PUT /api/listings/:id/photos/reorder` endpoint a drag interaction would.
 *
 * A listing must exist server-side before it can have photos (`POST /:id/photos` needs a real
 * `:id`) — in Add mode, the FOTO PROPERTI section is disabled with a hint until the first
 * "💾 Simpan Draft" succeeds, at which point this component switches itself into Edit mode
 * in-place (no modal close/reopen) using the newly created listing's real id.
 */
export function ListingModal({ editing, onClose, onSaved }: ListingModalProps): React.ReactElement {
  const [saved, setSaved] = useState<ListingDto | undefined>(editing);
  const isEdit = saved !== undefined;

  const [title, setTitle] = useState(editing?.title ?? "");
  const [propertyType, setPropertyType] = useState<PropertyType>(editing?.propertyType ?? "RUMAH");
  const [listingStatus, setListingStatus] = useState<ListingStatus>(
    editing?.listingStatus ?? "DRAFT",
  );
  const [price, setPrice] = useState(editing?.price !== undefined ? String(editing.price) : "");
  const [branchId, setBranchId] = useState(editing?.branchId ?? "");
  const [waNumber, setWaNumber] = useState(editing?.waNumber ?? "");

  const [landArea, setLandArea] = useState(editing?.landArea?.toString() ?? "");
  const [buildArea, setBuildArea] = useState(editing?.buildArea?.toString() ?? "");
  const [bedrooms, setBedrooms] = useState(editing?.bedrooms?.toString() ?? "");
  const [bathrooms, setBathrooms] = useState(editing?.bathrooms?.toString() ?? "");
  const [garage, setGarage] = useState(editing?.garage?.toString() ?? "");
  const [floors, setFloors] = useState(editing?.floors?.toString() ?? "");
  const [certificate, setCertificate] = useState(editing?.certificate ?? "");
  const [condition, setCondition] = useState(editing?.condition ?? "");
  const [facing, setFacing] = useState(editing?.facing ?? "");

  const [address, setAddress] = useState(editing?.address ?? "");
  const [city, setCity] = useState(editing?.city ?? "");
  const [province, setProvince] = useState(editing?.province ?? "");
  const [postalCode, setPostalCode] = useState(editing?.postalCode ?? "");

  const [description, setDescription] = useState(editing?.description ?? "");
  const [highlightsText, setHighlightsText] = useState((editing?.highlights ?? []).join("\n"));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoBusyId, setPhotoBusyId] = useState<string | undefined>(undefined);

  function buildPayload(): CreateListingInput | UpdateListingInput {
    const numOrUndefined = (raw: string): number | undefined =>
      raw.trim().length > 0 ? Number(raw) : undefined;
    return {
      title,
      propertyType,
      listingStatus,
      price: Number(price),
      ...(branchId.length > 0 ? { branchId } : {}),
      ...(waNumber.length > 0 ? { waNumber } : {}),
      ...(numOrUndefined(landArea) !== undefined ? { landArea: numOrUndefined(landArea) } : {}),
      ...(numOrUndefined(buildArea) !== undefined ? { buildArea: numOrUndefined(buildArea) } : {}),
      ...(numOrUndefined(bedrooms) !== undefined ? { bedrooms: numOrUndefined(bedrooms) } : {}),
      ...(numOrUndefined(bathrooms) !== undefined ? { bathrooms: numOrUndefined(bathrooms) } : {}),
      ...(numOrUndefined(garage) !== undefined ? { garage: numOrUndefined(garage) } : {}),
      ...(numOrUndefined(floors) !== undefined ? { floors: numOrUndefined(floors) } : {}),
      ...(certificate.length > 0 ? { certificate } : {}),
      ...(condition.length > 0 ? { condition } : {}),
      ...(facing.length > 0 ? { facing } : {}),
      ...(address.length > 0 ? { address } : {}),
      ...(city.length > 0 ? { city } : {}),
      ...(province.length > 0 ? { province } : {}),
      ...(postalCode.length > 0 ? { postalCode } : {}),
      ...(description.length > 0 ? { description } : {}),
      highlights: highlightsText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
    };
  }

  function validate(): string | undefined {
    if (title.trim().length === 0) {
      return "Judul wajib diisi.";
    }
    if (price.trim().length === 0 || Number.isNaN(Number(price)) || Number(price) <= 0) {
      return "Harga wajib diisi dengan angka positif.";
    }
    return undefined;
  }

  async function handleSave(publish: boolean): Promise<void> {
    const validationError = validate();
    if (validationError !== undefined) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      const payload = { ...buildPayload(), listingStatus: publish ? "AKTIF" : listingStatus };
      const url = isEdit ? `/api/listings/${encodeURIComponent(saved.id)}` : "/api/listings";
      const response = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await parseError(response, "Gagal menyimpan listing."));
      }
      const body = (await response.json()) as { listing: ListingDto };
      setSaved(body.listing);
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal menyimpan listing.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadPhotos(files: FileList): Promise<void> {
    if (saved === undefined) {
      return;
    }
    setPhotoUploading(true);
    setError(undefined);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.set("file", file);
        const response = await fetch(`/api/listings/${encodeURIComponent(saved.id)}/photos`, {
          method: "POST",
          body: formData,
        });
        if (!response.ok) {
          throw new Error(await parseError(response, "Gagal mengunggah foto."));
        }
        const body = (await response.json()) as { listing: ListingDto };
        setSaved(body.listing);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal mengunggah foto.");
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handleDeletePhoto(photoId: string): Promise<void> {
    if (saved === undefined) {
      return;
    }
    setPhotoBusyId(photoId);
    try {
      const response = await fetch(
        `/api/listings/${encodeURIComponent(saved.id)}/photos/${encodeURIComponent(photoId)}`,
        { method: "DELETE" },
      );
      if (response.ok) {
        const body = (await response.json()) as { listing: ListingDto };
        setSaved(body.listing);
      }
    } finally {
      setPhotoBusyId(undefined);
    }
  }

  async function handleReorder(photos: readonly PhotoDto[], mainPhotoId?: string): Promise<void> {
    if (saved === undefined) {
      return;
    }
    const response = await fetch(`/api/listings/${encodeURIComponent(saved.id)}/photos/reorder`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        photoIds: photos.map((p) => p.id),
        ...(mainPhotoId !== undefined ? { mainPhotoId } : {}),
      }),
    });
    if (response.ok) {
      const body = (await response.json()) as { listing: ListingDto };
      setSaved(body.listing);
    }
  }

  function movePhoto(index: number, direction: -1 | 1): void {
    if (saved === undefined) {
      return;
    }
    const photos = [...saved.photos].sort((a, b) => a.order - b.order);
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= photos.length) {
      return;
    }
    const swapped = [...photos];
    [swapped[index], swapped[targetIndex]] = [swapped[targetIndex]!, swapped[index]!];
    void handleReorder(swapped);
  }

  function setMainPhoto(photoId: string): void {
    if (saved === undefined) {
      return;
    }
    const photos = [...saved.photos].sort((a, b) => a.order - b.order);
    void handleReorder(photos, photoId);
  }

  const sortedPhotos = [...(saved?.photos ?? [])].sort((a, b) => a.order - b.order);

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Listing">
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.headerTitle}>{isEdit ? "Edit Listing" : "+ Tambah Listing"}</span>
          <button type="button" onClick={onClose} className={styles.closeButton} aria-label="Tutup">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          <p className={styles.sectionLabel}>INFORMASI DASAR</p>
          <div className={styles.formGroup}>
            <label htmlFor="listing-title" className={styles.formLabel}>
              Judul *
            </label>
            <input
              id="listing-title"
              className={styles.formInput}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Dijual Rumah Bintaro 88m²"
            />
          </div>
          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label htmlFor="listing-type" className={styles.formLabel}>
                Tipe Properti *
              </label>
              <select
                id="listing-type"
                className={styles.formInput}
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value as PropertyType)}
              >
                {PROPERTY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="listing-status" className={styles.formLabel}>
                Status *
              </label>
              <select
                id="listing-status"
                className={styles.formInput}
                value={listingStatus}
                onChange={(e) => setListingStatus(e.target.value as ListingStatus)}
              >
                {LISTING_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label htmlFor="listing-price" className={styles.formLabel}>
                Harga *
              </label>
              <input
                id="listing-price"
                type="number"
                className={styles.formInput}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="1800000000"
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="listing-branch" className={styles.formLabel}>
                Cabang/Area
              </label>
              <input
                id="listing-branch"
                className={styles.formInput}
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                placeholder="BINTARO"
              />
            </div>
          </div>

          <p className={styles.sectionLabel}>SPESIFIKASI</p>
          <div className={styles.row}>
            <NumberField
              id="listing-land"
              label="Luas Tanah (m²)"
              value={landArea}
              onChange={setLandArea}
            />
            <NumberField
              id="listing-build"
              label="Luas Bangunan (m²)"
              value={buildArea}
              onChange={setBuildArea}
            />
          </div>
          <div className={styles.row}>
            <NumberField
              id="listing-bedrooms"
              label="K.Tidur"
              value={bedrooms}
              onChange={setBedrooms}
            />
            <NumberField
              id="listing-bathrooms"
              label="K.Mandi"
              value={bathrooms}
              onChange={setBathrooms}
            />
          </div>
          <div className={styles.row}>
            <NumberField id="listing-garage" label="Garasi" value={garage} onChange={setGarage} />
            <NumberField id="listing-floors" label="Lantai" value={floors} onChange={setFloors} />
          </div>
          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label htmlFor="listing-certificate" className={styles.formLabel}>
                Sertifikat
              </label>
              <input
                id="listing-certificate"
                className={styles.formInput}
                value={certificate}
                onChange={(e) => setCertificate(e.target.value)}
                placeholder="SHM"
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="listing-condition" className={styles.formLabel}>
                Kondisi
              </label>
              <input
                id="listing-condition"
                className={styles.formInput}
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
              />
            </div>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="listing-facing" className={styles.formLabel}>
              Hadap
            </label>
            <input
              id="listing-facing"
              className={styles.formInput}
              value={facing}
              onChange={(e) => setFacing(e.target.value)}
              placeholder="Utara"
            />
          </div>

          <p className={styles.sectionLabel}>LOKASI</p>
          <div className={styles.formGroup}>
            <label htmlFor="listing-address" className={styles.formLabel}>
              Alamat
            </label>
            <input
              id="listing-address"
              className={styles.formInput}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label htmlFor="listing-city" className={styles.formLabel}>
                Kota/Kab
              </label>
              <input
                id="listing-city"
                className={styles.formInput}
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="listing-province" className={styles.formLabel}>
                Provinsi
              </label>
              <input
                id="listing-province"
                className={styles.formInput}
                value={province}
                onChange={(e) => setProvince(e.target.value)}
              />
            </div>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="listing-postal" className={styles.formLabel}>
              Kode Pos
            </label>
            <input
              id="listing-postal"
              className={styles.formInput}
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
            />
          </div>

          <p className={styles.sectionLabel}>DESKRIPSI & KEUNGGULAN</p>
          <div className={styles.formGroup}>
            <label htmlFor="listing-description" className={styles.formLabel}>
              Deskripsi
            </label>
            <textarea
              id="listing-description"
              className={styles.formTextarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="listing-highlights" className={styles.formLabel}>
              Keunggulan (1 per baris)
            </label>
            <textarea
              id="listing-highlights"
              className={styles.formTextarea}
              value={highlightsText}
              onChange={(e) => setHighlightsText(e.target.value)}
              rows={3}
              placeholder={"Dekat sekolah\nBebas banjir"}
            />
          </div>

          <p className={styles.sectionLabel}>FOTO PROPERTI *</p>
          {saved === undefined ? (
            <p className={styles.hint}>💾 Simpan Draft dulu untuk mulai menambah foto.</p>
          ) : (
            <div className={styles.photoSection}>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={photoUploading}
                onChange={(e) => {
                  if (e.target.files !== null && e.target.files.length > 0) {
                    void handleUploadPhotos(e.target.files);
                    e.target.value = "";
                  }
                }}
              />
              {photoUploading ? <p className={styles.hint}>Mengunggah...</p> : null}
              <div className={styles.photoGrid}>
                {sortedPhotos.map((photo, index) => (
                  <div key={photo.id} className={styles.photoTile}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- external GCS URL */}
                    <img
                      src={photo.url}
                      alt={photo.label ?? "Foto properti"}
                      className={styles.photoTileImg}
                    />
                    <button
                      type="button"
                      className={`${styles.mainToggle} ${photo.isMain ? styles.mainToggleActive : ""}`}
                      onClick={() => setMainPhoto(photo.id)}
                      aria-label="Set foto utama"
                    >
                      {photo.isMain ? "⭐ Utama" : "☆ Set Utama"}
                    </button>
                    <div className={styles.photoTileActions}>
                      <button
                        type="button"
                        onClick={() => movePhoto(index, -1)}
                        aria-label="Naikkan urutan"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => movePhoto(index, 1)}
                        aria-label="Turunkan urutan"
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        disabled={photoBusyId === photo.id}
                        onClick={() => void handleDeletePhoto(photo.id)}
                        aria-label="Hapus foto"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className={styles.sectionLabel}>NOMOR WA AGEN</p>
          <div className={styles.formGroup}>
            <label htmlFor="listing-wa" className={styles.formLabel}>
              Nomor WA agen yang handle listing ini
            </label>
            <input
              id="listing-wa"
              className={styles.formInput}
              value={waNumber}
              onChange={(e) => setWaNumber(e.target.value)}
              placeholder="+628123456789"
            />
          </div>

          {error !== undefined ? <p className={styles.error}>{error}</p> : null}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.cancelButton} onClick={onClose}>
            Batal
          </button>
          <button
            type="button"
            className={styles.smallButton}
            onClick={() => void handleSave(false)}
            disabled={saving}
          >
            {saving ? "Menyimpan..." : "💾 Simpan Draft"}
          </button>
          <button
            type="button"
            className={styles.saveButton}
            onClick={() => void handleSave(true)}
            disabled={saving}
          >
            {saving ? "Menyimpan..." : "✓ Publish Listing"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}): React.ReactElement {
  return (
    <div className={styles.formGroup}>
      <label htmlFor={id} className={styles.formLabel}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        className={styles.formInput}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
