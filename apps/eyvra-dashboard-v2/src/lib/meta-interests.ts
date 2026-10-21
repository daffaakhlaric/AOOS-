export interface StoredInterest {
  id: string;
  name: string;
  searchTerm: string;
  fetchedAt: string;
}
/** Conservative name-based ranking of actual catalogue entries; no invented Meta IDs. */
export function selectPropertyInterests(rows: StoredInterest[], propertyType: string) {
  const relevant =
    /\b(real estate|property invest|house \(property\)|apartment|home improvement|interior design|home decoration|land invest|residential)/i;
  const unrelated = /\b(band|music|tv series|shows|hgtv|coffee|license|contract|association)\b/i;
  const preferred =
    propertyType === "TANAH"
      ? /land|property invest/i
      : propertyType === "APARTEMEN"
        ? /apartment|interior/i
        : propertyType === "RUKO"
          ? /commercial|real estate|property invest/i
          : /house \(property\)|home improvement|interior/i;
  const score = (r: StoredInterest) =>
    (preferred.test(r.name) ? 10 : 0) +
    (/^House \(property\)$/i.test(r.name) && propertyType === "RUMAH" ? 20 : 0);
  return [
    ...new Map(
      rows
        .filter((r) => /^\d+$/.test(r.id) && relevant.test(r.name) && !unrelated.test(r.name))
        .map((r) => [r.id, r]),
    ).values(),
  ]
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name))
    .slice(0, 5);
}
