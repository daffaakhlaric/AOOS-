"use client";
import { useState } from "react";
interface Resources {
  credentialVersion: number;
  selectedAdAccountId: string;
  selectedPageId: string | null;
  selectedInstagramId: string | null;
  selectedWhatsAppNumber: string | null;
  pages: { id: string; name: string }[];
  instagramAccounts: { id: string; username?: string; pageId: string }[];
  whatsappNumbers: { phoneNumberId: string; displayNumber: string; wabaName: string }[];
  issues: string[];
}
export function MetaDestinationPicker() {
  const [resources, setResources] = useState<Resources>();
  const [page, setPage] = useState("");
  const [instagram, setInstagram] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function load() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/integrations/resources", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw Error(data.message);
      setResources(data);
      setPage(data.selectedPageId ?? "");
      setInstagram(data.selectedInstagramId ?? "");
      setWhatsapp(data.selectedWhatsAppNumber ?? "");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Gagal memuat aset.");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!resources) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/integrations/resources", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credentialVersion: resources.credentialVersion,
          pageId: page,
          instagramId: instagram || null,
          whatsappNumber: whatsapp || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.message);
      setResources(undefined);
      setMessage(
        "Pilihan tersimpan. Muat ulang aset sebelum mengubahnya lagi. Kesiapan iklan dan hubungan Page–WhatsApp tetap diperiksa saat preflight.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Gagal menyimpan pilihan.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Tujuan iklan Meta" style={{ display: "grid", gap: 12, marginTop: 20 }}>
      <h3>Page, Instagram & WhatsApp</h3>
      <button type="button" onClick={load} disabled={busy}>
        {busy ? "Memproses…" : "Muat pilihan aset Meta"}
      </button>
      {message && <p role="status">{message}</p>}
      {resources && (
        <>
          <p>Akun terpilih: {resources.selectedAdAccountId}</p>
          <label>
            Facebook Page{" "}
            <select
              aria-label="Facebook Page"
              disabled={busy}
              value={page}
              onChange={(e) => {
                setPage(e.target.value);
                setInstagram("");
              }}
            >
              <option value="">Pilih Page</option>
              {resources.pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Instagram{" "}
            <select
              aria-label="Instagram"
              disabled={busy || !page}
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
            >
              <option value="">Tidak dipilih</option>
              {resources.instagramAccounts
                .filter((i) => i.pageId === page)
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.username ?? i.id}
                  </option>
                ))}
            </select>
          </label>
          <label>
            WhatsApp Business{" "}
            <select
              aria-label="WhatsApp Business"
              disabled={busy}
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
            >
              <option value="">Tidak dipilih</option>
              {resources.whatsappNumbers.map((w) => (
                <option key={w.phoneNumberId} value={w.displayNumber}>
                  {w.wabaName} · {w.displayNumber}
                </option>
              ))}
            </select>
          </label>
          {resources.issues.map((issue) => (
            <p key={issue}>{issue}</p>
          ))}
          <button type="button" disabled={busy || !page} onClick={save}>
            Simpan tujuan iklan
          </button>
        </>
      )}
    </section>
  );
}
