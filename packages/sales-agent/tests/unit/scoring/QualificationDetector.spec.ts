import { describe, expect, it } from "vitest";

import { QualificationStatus } from "../../../src/domain/value-objects/QualificationStatus.js";
import { QualificationDetector } from "../../../src/scoring/QualificationDetector.js";

function statusesOf(text: string): QualificationStatus[] {
  return QualificationDetector.detect(text).map((match) => match.status);
}

describe("QualificationDetector", () => {
  it('"budget 200 juta" → BUDGET qualified', () => {
    const matches = QualificationDetector.detect("budget 200 juta");
    const budget = matches.find((m) => m.status === QualificationStatus.BUDGET);
    expect(budget).toBeDefined();
    expect(budget?.extractedText).toContain("200");
  });

  it('"mau Xpander 2019" → UNIT qualified', () => {
    const matches = QualificationDetector.detect("mau Xpander 2019");
    const unit = matches.find((m) => m.status === QualificationStatus.UNIT);
    expect(unit).toBeDefined();
    expect(unit?.extractedText.toLowerCase()).toContain("xpander");
  });

  it('"area Depok" → AREA qualified', () => {
    expect(statusesOf("area Depok")).toContain(QualificationStatus.AREA);
  });

  it('"mau kredit" → PAYMENT qualified', () => {
    const matches = QualificationDetector.detect("mau kredit");
    const payment = matches.find((m) => m.status === QualificationStatus.PAYMENT);
    expect(payment?.extractedText).toBe("Kredit");
  });

  it('"cash aja" → PAYMENT qualified as Cash', () => {
    const matches = QualificationDetector.detect("cash aja kak");
    const payment = matches.find((m) => m.status === QualificationStatus.PAYMENT);
    expect(payment?.extractedText).toBe("Cash");
  });

  it('"segera bulan ini" → TIMELINE qualified', () => {
    expect(statusesOf("mau segera bulan ini")).toContain(QualificationStatus.TIMELINE);
  });

  it('"nama saya Budi" → NAME qualified, extracts "Budi"', () => {
    const matches = QualificationDetector.detect("nama saya Budi");
    const name = matches.find((m) => m.status === QualificationStatus.NAME);
    expect(name?.extractedText).toBe("Budi");
  });

  it("a message with no matches returns an empty array", () => {
    expect(QualificationDetector.detect("halo")).toEqual([]);
  });

  it("recognizes a plain city name without the 'area' keyword", () => {
    expect(statusesOf("saya di Bintaro")).toContain(QualificationStatus.AREA);
  });

  it("detects multiple qualification criteria in a single message", () => {
    const statuses = statusesOf("budget 200 juta mau Xpander area Depok mau kredit");
    expect(statuses).toEqual(
      expect.arrayContaining([
        QualificationStatus.BUDGET,
        QualificationStatus.UNIT,
        QualificationStatus.AREA,
        QualificationStatus.PAYMENT,
      ]),
    );
  });
});
