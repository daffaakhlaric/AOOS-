import { BranchId } from "../domain/value-objects/BranchId.js";

export interface JessyBranchKnowledge {
  readonly name: string;
  readonly area: string;
}

/** DSS Motor / Mobix brand knowledge Jessy always knows (spec "JessyKnowledgeBase"). Mirrors `@aos/meta-ads-agent`'s `BusinessKnowledgeBase` pattern: real, structured, queryable static data, not prose. */
export const JESSY_KNOWLEDGE = {
  brand: "Mobix by DSS Motor",
  slogan: "Xtra Aman, Xtra Yakin",
  inspection: "inspeksi 150+ titik",
  guarantee: "Diverifikasi Otospector",
  finance: "Dipo Star Finance (mocil.id)",
  paymentOptions: ["Tunai", "Kredit Konvensional", "Kredit Syariah"] as const,

  objectionHandlers: {
    "takut bermasalah":
      "Tenang kak, semua unit Mobix sudah diinspeksi 150+ titik dan diverifikasi Otospector 😊 Garansi tersedia juga.",
    "takut kredit ditolak":
      "Kita bantu proses kredit kak, ada beberapa leasing partner. Kemungkinan approval-nya tinggi kalau dokumen lengkap 😊",
    mahal:
      "Harga di Mobix sudah transparan kak, gak ada biaya tersembunyi. Bisa simulasi cicilan dulu kalau mau 😊",
    "pikir dulu":
      "No problem kak! Stok terbatas soalnya, kalau mau kak bisa reserve dulu biar gak keburu diambil orang 😊",
  } as const,

  branches: {
    [BranchId.BINTARO]: { name: "Mobix Bintaro", area: "Tangerang Selatan, Serpong, BSD" },
    [BranchId.CINERE]: { name: "Mobix Cinere", area: "Depok, Jakarta Selatan, Limo" },
    [BranchId.UMUM]: { name: "Mobix Pondok Bambu", area: "Jakarta Timur, Bekasi" },
    [BranchId.BANDUNG]: { name: "Mobix Bandung", area: "Bandung, Cimahi" },
  } satisfies Record<BranchId, JessyBranchKnowledge>,
};

export type JessyObjectionKey = keyof typeof JESSY_KNOWLEDGE.objectionHandlers;

/** Static, queryable accessors over `JESSY_KNOWLEDGE` — the query surface `ObjectionResponses`/`ConversationEngine` use. */
export class JessyKnowledgeBase {
  static branch(id: BranchId): JessyBranchKnowledge {
    return JESSY_KNOWLEDGE.branches[id];
  }

  /** Case-insensitive substring match against the known objection keys (e.g. "kayaknya mahal ya" → "mahal"). `undefined` if none match. */
  static findObjectionHandler(messageText: string): string | undefined {
    const normalized = messageText.toLowerCase();
    const match = (Object.keys(JESSY_KNOWLEDGE.objectionHandlers) as JessyObjectionKey[]).find(
      (key) => normalized.includes(key),
    );
    return match === undefined ? undefined : JESSY_KNOWLEDGE.objectionHandlers[match];
  }
}
