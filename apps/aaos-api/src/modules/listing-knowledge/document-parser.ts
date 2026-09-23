import { createRequire } from "node:module";
import { extname, dirname, join } from "node:path";

import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";
import { XMLParser } from "fast-xml-parser";
import { unzipSync } from "fflate";

import { KnowledgeError, type ParsedSection } from "./knowledge.types.js";
const MAX_TEXT = 2_000_000,
  MAX_ROWS = 20_000;
function checked(sections: ParsedSection[]): ParsedSection[] {
  if (!sections.some((s) => s.text.trim())) throw new KnowledgeError("EMPTY_DOCUMENT");
  if (sections.length > MAX_ROWS || sections.reduce((n, s) => n + s.text.length, 0) > MAX_TEXT)
    throw new KnowledgeError("DOCUMENT_TOO_COMPLEX");
  return sections;
}
function rowsToSections(
  rows: { number: number; cells: string[] }[],
  sheet?: string,
): ParsedSection[] {
  const candidateHeaders = rows.slice(0, 50).map((row) => ({
    row,
    score: row.cells.filter((cell) =>
      /^(harga|price|unit|kode|type|tipe|promo|dp|cluster|luas|kpr)/i.test(cell.trim()),
    ).length,
  }));
  const header =
    candidateHeaders.sort((a, b) => b.score - a.score || a.row.number - b.row.number)[0]?.row ??
    rows.find((r) => r.cells.some(Boolean));
  if (!header) return [];
  return rows
    .filter((r) => r.number > header.number && r.cells.some(Boolean))
    .map((row) => ({
      text: row.cells
        .map((value, i) =>
          value ? String(header.cells[i] || "Column " + (i + 1)) + ": " + value : "",
        )
        .filter(Boolean)
        .join(" | "),
      source: {
        ...(sheet ? { sheet } : {}),
        rowStart: row.number,
        rowEnd: row.number,
        section: "Header row " + header.number,
      },
    }));
}
export async function parseDocument(bytes: Buffer, fileName: string): Promise<ParsedSection[]> {
  const ext = extname(fileName).toLowerCase();
  if (ext === ".txt") {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return checked(
      text.split(/\n\s*\n/).map((text, i) => ({ text, source: { paragraph: i + 1 } })),
    );
  }
  if (ext === ".csv") {
    const rows = parse(bytes, {
      bom: true,
      skip_empty_lines: false,
      relax_column_count: true,
      max_record_size: 100_000,
    }) as string[][];
    return checked(rowsToSections(rows.map((cells, i) => ({ number: i + 1, cells }))));
  }
  if (ext === ".xlsx") {
    inspectZip(bytes);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(bytes as unknown as Parameters<typeof book.xlsx.load>[0]);
    const result: ParsedSection[] = [];
    for (const sheet of book.worksheets) {
      const rows: { number: number; cells: string[] }[] = [];
      sheet.eachRow((row, number) => {
        const cells: string[] = [];
        row.eachCell({ includeEmpty: true }, (cell, col) => {
          cells[col - 1] = cell.text;
        });
        rows.push({ number, cells });
      });
      result.push(...rowsToSections(rows, sheet.name));
    }
    return checked(result);
  }
  if (ext === ".docx") {
    const files = inspectZip(bytes);
    const xml = files["word/document.xml"];
    if (!xml) throw new KnowledgeError("INVALID_DOCX");
    const parser = new XMLParser({
      preserveOrder: true,
      ignoreAttributes: false,
      processEntities: false,
    });
    const nodes = parser.parse(new TextDecoder().decode(xml)) as XmlNode[];
    const result: ParsedSection[] = [];
    let paragraph = 0,
      table = 0;
    const walk = (list: XmlNode[]) => {
      for (const node of list) {
        for (const [tag, children] of Object.entries(node)) {
          if (tag === "w:p") {
            const text = xmlText(children);
            if (text.trim()) result.push({ text, source: { paragraph: ++paragraph } });
          } else if (tag === "w:tbl") {
            table++;
            const rows = Array.isArray(children)
              ? children.flatMap((n) => (n["w:tr"] ? [n["w:tr"]] : []))
              : [];
            const values = rows.map((row, i) => ({
              number: i + 1,
              cells: Array.isArray(row)
                ? row.flatMap((n) => (n["w:tc"] ? [xmlText(n["w:tc"])] : []))
                : [],
            }));
            result.push(
              ...rowsToSections(values).map((s) => ({
                ...s,
                source: { ...s.source, section: "Table " + table },
              })),
            );
          } else if (Array.isArray(children)) walk(children);
        }
      }
    };
    walk(nodes);
    return checked(result);
  }
  if (ext === ".pdf") {
    if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new KnowledgeError("INVALID_PDF");
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const task = getDocument({
      data: new Uint8Array(bytes),
      useSystemFonts: false,
      standardFontDataUrl:
        join(
          dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json")),
          "standard_fonts",
        ).replaceAll("\\", "/") + "/",
    });
    try {
      const pdf = await task.promise;
      if (pdf.numPages > 300) throw new KnowledgeError("DOCUMENT_TOO_COMPLEX");
      const result: ParsedSection[] = [];
      for (let page = 1; page <= pdf.numPages; page++) {
        const content = await (await pdf.getPage(page)).getTextContent();
        result.push({
          text: content.items
            .map((item) =>
              "str" in item ? item.str + ("hasEOL" in item && item.hasEOL ? "\n" : " ") : "",
            )
            .join(""),
          source: { page },
        });
      }
      if (result.every((s) => s.text.trim().length < 8)) throw new KnowledgeError("OCR_REQUIRED");
      return checked(result);
    } finally {
      await task.destroy();
    }
  }
  throw new KnowledgeError("UNSUPPORTED_FORMAT");
}
type XmlNode = { [key: string]: XmlNode[] | string };
function xmlText(value: XmlNode[] | string | undefined): string {
  if (typeof value === "string") return value;
  return (value ?? [])
    .map((n) =>
      Object.entries(n)
        .filter(([k]) => k !== ":@")
        .map(([k, v]) => (k === "#text" ? String(v) : xmlText(v)))
        .join(""),
    )
    .join(" ");
}
function inspectZip(bytes: Buffer) {
  let expanded = 0;
  return unzipSync(bytes, {
    filter: (file) => {
      expanded += file.originalSize;
      if (expanded > 50_000_000 || file.originalSize > 20_000_000)
        throw new KnowledgeError("DOCUMENT_TOO_COMPLEX");
      return true;
    },
  });
}
