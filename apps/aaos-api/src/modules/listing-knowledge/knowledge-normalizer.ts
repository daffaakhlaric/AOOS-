import { createHash } from "node:crypto";

import type { KnowledgeChunk, KnowledgeFact, ParsedSection } from "./knowledge.types.js";
export function hashContent(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}
export function normalizeRupiah(raw: string): number | undefined {
  const match = raw
    .trim()
    .match(/^(?:Rp\s*)?([\d.,]+)\s*(miliar|milyar|milyard|miliar|m|b|juta|jt|ribu|rb)?$/i);
  if (!match) return undefined;
  const suffix = match[2]?.toLowerCase();
  let numeric = match[1] ?? "";
  numeric = suffix
    ? numeric.replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".")
    : numeric.replace(/\./g, "").replace(",", ".");
  const multiplier = ["miliar", "milyar", "milyard", "m", "b"].includes(suffix ?? "")
    ? 1e9
    : ["juta", "jt"].includes(suffix ?? "")
      ? 1e6
      : ["ribu", "rb"].includes(suffix ?? "")
        ? 1e3
        : 1;
  const value = Number(numeric) * multiplier;
  return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}
export function extractFacts(section: ParsedSection): KnowledgeFact[] {
  const facts: KnowledgeFact[] = [];
  for (const match of section.text.matchAll(
    /(?:harga|price)\s*[:=]?\s*((?:Rp\s*)?[\d.,]+\s*(?:miliar|milyar|juta|jt|ribu|rb|m|b)?)(?=\s|[;|]|$)/gi,
  )) {
    const raw = match[1]?.trim() ?? "";
    const value = normalizeRupiah(raw);
    if (value !== undefined) facts.push({ key: "price", value, raw, source: section.source });
  }
  for (const match of section.text.matchAll(
    /(?:promo\s+)?DP\s*[:=]?\s*(?:mulai\s*)?(\d+(?:[.,]\d+)?)\s*%/gi,
  ))
    facts.push({
      key: "downPaymentPercent",
      value: Number(match[1]?.replace(",", ".")),
      raw: match[0],
      source: section.source,
    });
  for (const match of section.text.matchAll(/\b(SHM|HGB|SHGB)\b/g))
    facts.push({ key: "certificate", value: match[0], raw: match[0], source: section.source });
  return facts;
}
/** Preserve spreadsheet row/header relationships and PDF page boundaries. Never split a fact from its provenance. */
export function buildChunks(sections: ParsedSection[], maxCharacters = 3200): KnowledgeChunk[] {
  const result: KnowledgeChunk[] = [];
  for (const section of sections) {
    const text = section.text
      .replace(/\r/g, "")
      .replace(/[ \t]+/g, " ")
      .trim();
    if (!text) continue;
    // Preserve source boundaries. Only retain facts fully contained in a chunk; never reinterpret a truncated number.
    const allFacts = extractFacts({ text, source: section.source });
    const parts: string[] = [];
    let rest = text;
    while (rest.length > maxCharacters) {
      let cut = rest.lastIndexOf("\n", maxCharacters);
      if (cut < maxCharacters / 2) cut = rest.lastIndexOf(" ", maxCharacters);
      if (cut < 1) cut = maxCharacters;
      parts.push(rest.slice(0, cut));
      rest = rest.slice(cut).trim();
    }
    if (rest) parts.push(rest);
    for (const part of parts) {
      const normalized = { text: part, source: section.source };
      result.push({
        ...normalized,
        sequence: result.length,
        hash: hashContent(JSON.stringify(normalized)),
        facts: allFacts.filter((f) => part.includes(f.raw)),
      });
    }
  }
  return result;
}
export function detectPriceConflicts(
  listingPrice: number,
  hits: { document_id: string; facts: KnowledgeFact[] }[],
) {
  return hits.flatMap((hit) =>
    hit.facts
      .filter((f) => f.key === "price" && typeof f.value === "number" && f.value !== listingPrice)
      .map((f) => ({
        field: "price",
        listingValue: listingPrice,
        documentValue: f.value,
        documentId: hit.document_id,
        source: f.source,
        status: "UNRESOLVED" as const,
      })),
  );
}

/** Include document/sheet names in both FTS and embeddings, without treating metadata as property facts. */
export function attachDocumentContext(
  chunks: KnowledgeChunk[],
  fileName: string,
): KnowledgeChunk[] {
  return chunks.map((chunk) => {
    const label = [
      fileName,
      chunk.source.sheet ? "Sheet " + chunk.source.sheet : undefined,
      chunk.source.page ? "Page " + chunk.source.page : undefined,
      chunk.source.rowStart ? "Row " + chunk.source.rowStart : undefined,
    ]
      .filter(Boolean)
      .join(" → ");
    const text = label + "\n" + chunk.text;
    return { ...chunk, text, hash: hashContent(text + JSON.stringify(chunk.source)) };
  });
}
