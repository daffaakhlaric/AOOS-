// Test-only media geometry. Not imported by any production route.
import React from "react";
import { createRoot } from "react-dom/client";
import { ListingsPage } from "@/components/listings/ListingsPage";
import { AppShell } from "@/components/layout/AppShell";
import { listingFixture } from "../lib/listing-fixture";
import "@/app/globals.css";
const data = [
  ["Tanah contoh BSD 500m² SHM", "TANAH", "Tangerang Selatan", 4200000000],
  ["Ruko contoh PIK2", "RUKO", "Jakarta Utara", 6800000000],
  ["Rumah contoh Kedoya 3BR", "RUMAH", "Jakarta Barat", 3700000000],
  ["Apartemen contoh Cempaka Putih", "APARTEMEN", "Jakarta Pusat", 1200000000],
].map(([title, type, city, price], i) => {
  const item = listingFixture("fixture-" + i, String(title));
  item.listing.propertyType = String(type);
  item.listing.city = String(city);
  item.listing.price = Number(price);
  item.listing.landArea = i === 0 ? 500 : 120;
  item.listing = {
    ...item.listing,
    photos: [{ id: "photo", url: "/tests/visual/listing-test.svg", isMain: true, order: 0 }],
  };
  item.copy.primaryText = `${title}. Lokasi ${city}. Hubungi untuk informasi dan jadwal survei.`;
  item.copy.description = `Informasi properti di ${city}.`;
  if (i === 3) {
    item.listing = { ...item.listing, photos: [] };
    item.readiness.ready = false;
    item.readiness.checks = item.readiness.checks.map((c) => ({
      ...c,
      passed: c.name !== "usablePhotos",
    }));
  }
  return item;
});
window.fetch = async (input) => {
  const url = String(input);
  const body = url.includes("growth-objectives")
    ? {
        objectives: [
          { id: "goal", targetValue: 50, startDate: "2026-09-01", endDate: "2026-09-30" },
        ],
      }
    : url.includes("strategy")
      ? {
          blueprint: {
            goal: "GENERATE_HOT_LEADS",
            destination: "WHATSAPP",
            campaign: { name: "Fixture plan", objective: "OUTCOME_LEADS", initialStatus: "PAUSED" },
            adSet: {
              audienceStrategy: "LOCAL",
              geo: { city: "Tangerang Selatan", province: "Banten" },
              placements: [],
            },
            creativeStrategy: { formats: ["IMAGE"] },
            warnings: [],
          },
        }
      : url.includes("creative")
        ? { packages: [] }
        : {
            listings: data,
            total: 4,
            campaigns: [
              {
                id: "campaign",
                listingId: "fixture-2",
                name: "Campaign fixture",
                status: "ACTIVE",
                syncedAt: "2026-09-22",
              },
            ],
            errors: [],
          };
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
};
createRoot(document.getElementById("root")!).render(
  <>
    <div
      style={{
        position: "fixed",
        bottom: 5,
        left: "45%",
        zIndex: 100,
        fontSize: 11,
        color: "#665577",
        background: "white",
        padding: 5,
      }}
    >
      LAYOUT TEST FIXTURE · Not live account data
    </div>
    <AppShell>
      <ListingsPage />
    </AppShell>
  </>,
);
