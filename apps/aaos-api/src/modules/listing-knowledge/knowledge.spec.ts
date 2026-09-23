import ExcelJS from "exceljs";
import { zipSync, strToU8 } from "fflate";
import { describe, it, expect } from "vitest";

import { parseDocument } from "./document-parser.js";
import {
  attachDocumentContext,
  buildChunks,
  normalizeRupiah,
  detectPriceConflicts,
} from "./knowledge-normalizer.js";
describe("document evidence", () => {
  it("retains the exact sheet and original row for prices and DP", async () => {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet("Type 120");
    sheet.getRow(1).values = ["Unit", "Harga", "Promo DP"];
    sheet.getRow(12).values = ["A-120", "Rp3,7M", "10%"];
    const other = book.addWorksheet("Type 90");
    other.addRow(["Unit", "Harga"]);
    other.addRow(["B-90", "Rp2,1M"]);
    const data = await parseDocument(
      Buffer.from(await book.xlsx.writeBuffer()),
      "Price List BSD September.xlsx",
    );
    const chunks = buildChunks(data);
    expect(chunks[0]?.source).toMatchObject({ sheet: "Type 120", rowStart: 12, rowEnd: 12 });
    expect(chunks[0]?.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "price", value: 3700000000 }),
        expect.objectContaining({ key: "downPaymentPercent", value: 10 }),
      ]),
    );
    expect(chunks[1]?.source.sheet).toBe("Type 90");
  });
  it("preserves quoted CSV fields and physical blank rows", async () => {
    const parsed = await parseDocument(
      Buffer.from('Unit,Harga,Promo DP\n\nA-1,"Rp3,7M",10%'),
      "prices.csv",
    );
    expect(parsed[0]?.source.rowStart).toBe(3);
    expect(parsed[0]?.text).toContain("Harga: Rp3,7M");
  });
  it("preserves DOCX paragraphs and table cells", async () => {
    const xml =
      '<w:document xmlns:w="x"><w:body><w:p><w:r><w:t>Promo September</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Harga</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>Rp3,7M</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>';
    const parsed = await parseDocument(
      Buffer.from(zipSync({ "word/document.xml": strToU8(xml) })),
      "promo.docx",
    );
    expect(parsed[0]).toMatchObject({ text: "Promo September", source: { paragraph: 1 } });
    expect(parsed[1]?.text).toContain("Harga: Rp3,7M");
    expect(parsed[1]?.source).toMatchObject({ section: "Table 1", rowStart: 2 });
  });
  it("splits text without losing its paragraph provenance", async () => {
    const parsed = await parseDocument(Buffer.from("Lokasi BSD\n\nPromo DP 10%"), "promo.txt");
    expect(buildChunks(parsed)[1]?.facts[0]).toMatchObject({
      key: "downPaymentPercent",
      value: 10,
      source: { paragraph: 2 },
    });
  });
  it.each(["Rp3,7M", "3.700.000.000", "Rp 3,7 miliar"])("normalizes %s", (raw) =>
    expect(normalizeRupiah(raw)).toBe(3700000000),
  );
  it("does not overwrite conflicting structured prices", () => {
    const hits = [
      {
        document_id: "d1",
        facts: buildChunks([
          { text: "Harga: Rp3,5M", source: { sheet: "Type 120", rowStart: 12 } },
        ])[0]!.facts,
      },
    ];
    expect(detectPriceConflicts(3700000000, hits)[0]).toMatchObject({
      documentValue: 3500000000,
      listingValue: 3700000000,
      status: "UNRESOLVED",
      source: { rowStart: 12 },
    });
  });
  it.each(["pptx", "xls", "exe"])("rejects unsupported %s", async (ext) =>
    expect(parseDocument(Buffer.from("test"), "file." + ext)).rejects.toThrow("UNSUPPORTED_FORMAT"),
  );
  it("rejects empty and corrupted files", async () => {
    await expect(parseDocument(Buffer.from(""), "empty.txt")).rejects.toThrow("EMPTY_DOCUMENT");
    await expect(parseDocument(Buffer.from("invalid"), "bad.xlsx")).rejects.toThrow();
    await expect(parseDocument(Buffer.from("invalid"), "bad.pdf")).rejects.toThrow("INVALID_PDF");
  });
});

function pdfFixture(pages: string[]) {
  const objects: string[] = ["<< /Type /Catalog /Pages 2 0 R >>", ""];
  const kids: number[] = [];
  for (const text of pages) {
    const pageId = objects.length + 1,
      contentId = pageId + 1;
    kids.push(pageId);
    const stream = "BT /F1 12 Tf 50 700 Td (" + text + ") Tj ET";
    objects.push(
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents " +
        contentId +
        " 0 R >>",
      "<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream",
    );
  }
  objects[1] =
    "<< /Type /Pages /Count " +
    pages.length +
    " /Kids [" +
    kids.map((id) => id + " 0 R").join(" ") +
    "] >>";
  let data = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(data));
    data += i + 1 + " 0 obj\n" + obj + "\nendobj\n";
  });
  const xref = Buffer.byteLength(data);
  data +=
    "xref\n0 " +
    (objects.length + 1) +
    "\n0000000000 65535 f \n" +
    offsets
      .slice(1)
      .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
      .join("") +
    "trailer\n<< /Size " +
    (objects.length + 1) +
    " /Root 1 0 R >>\nstartxref\n" +
    xref +
    "\n%%EOF";
  return Buffer.from(data);
}
it("extracts PDF pages with original page references", async () => {
  const data = await parseDocument(pdfFixture(["Harga Rp3,7M", "Promo DP 10%"]), "promo.pdf");
  expect(data.map((p) => p.source.page)).toEqual([1, 2]);
  expect(data[1]?.text).toContain("DP 10%");
});
it("detects PDF with no usable text as OCR_REQUIRED", async () => {
  await expect(parseDocument(pdfFixture([""]), "scan.pdf")).rejects.toThrow("OCR_REQUIRED");
});

it("never turns a truncated currency unit into a different price", () => {
  const chunks = buildChunks([{ text: "Harga: Rp3,7 miliar", source: { rowStart: 12 } }], 12);
  expect(chunks.flatMap((c) => c.facts)).toEqual([]);
});

it("indexes document and sheet names without extracting metadata as facts", () => {
  const chunks = attachDocumentContext(
    buildChunks([{ text: "Harga: Rp3,7M", source: { sheet: "Type 120", rowStart: 12 } }]),
    "Price List BSD September.xlsx",
  );
  expect(chunks[0]?.text).toContain("Price List BSD September.xlsx → Sheet Type 120 → Row 12");
  expect(chunks[0]?.facts).toHaveLength(1);
});
