import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePurchase, similarity } from "./valuation-engine.mjs";

const subject = {
  make: "Volkswagen",
  model: "ID.4",
  generation: "ID.4",
  trim: "Pro Performance",
  fuel: "electric",
  battery_kwh: 77,
  power_cv: 204,
  drivetrain: "RWD",
  year: 2021,
  first_registration: "2021-08-01",
  mileage_km: 59517,
  equipment: ["heat pump", "adaptive cruise"],
  vat_deductible: true,
  price: 22900,
};

const comparables = [
  { ...subject, price: 27900, mileage_km: 61000, days_since_seen: 5, url: "c1" },
  { ...subject, price: 28490, mileage_km: 52000, days_since_seen: 7, url: "c2" },
  { ...subject, price: 26990, mileage_km: 72000, days_since_seen: 4, url: "c3" },
  { ...subject, price: 27500, mileage_km: 68000, days_since_seen: 12, url: "c4" },
  { ...subject, price: 28900, mileage_km: 47000, days_since_seen: 3, url: "c5" },
  // outlier
  { ...subject, price: 37900, mileage_km: 60000, days_since_seen: 2, url: "outlier" },
  // incompatível
  { ...subject, battery_kwh: 52, trim: "Pure", price: 23900, url: "wrong-battery" },
];

test("same car scores highly", () => {
  assert.ok(similarity(subject, comparables[0]) >= 90);
});

test("evaluation returns a bounded decision and excludes incompatible data", () => {
  const result = evaluatePurchase({
    subject,
    comparables,
    current_purchase_price: 22900,
    costs: {
      auction_fee: 650,
      transport: 250,
      reconditioning: 500,
      warranty_reserve: 450,
      stock_finance: 150,
    },
    target_margin: 3000,
    minimum_margin: 1800,
  });

  assert.ok(result.market.marketValue > 25000);
  assert.ok(result.market.marketValue < 32000);
  assert.ok(result.market.comparablesUsed >= 4);
  assert.ok(result.excluded.some(x => x.reason.includes("bateria")));
  assert.ok(["compra muito interessante", "boa compra", "comprar só com justificação", "não comprar"].includes(result.purchase.decision));
  assert.ok(Number.isFinite(result.purchase.maxPurchase));
});


test("older target is valued below an otherwise identical newer comparable", () => {
  const olderSubject = {
    ...subject,
    first_registration: "2021-08-01",
    mileage_km: 60000,
  };
  const newerComp = {
    ...olderSubject,
    first_registration: "2021-12-01",
    price: 26000,
    days_since_seen: 1,
    url: "newer-comp",
  };

  const result = evaluatePurchase({
    subject: olderSubject,
    comparables: [newerComp],
    current_purchase_price: 20000,
    negotiation_discount_pct: 0,
    fast_sale_discount_pct: 0,
    costs: {},
    target_margin: 0,
    minimum_margin: 0,
  }, {
    minSimilarity: 0,
    riskReservePct: 0,
    kmAdjustmentPer1000: 0,
    ageAdjustmentPerMonth: 85,
    equipmentUnitAdjustment: 0,
  });

  assert.equal(result.market.marketValue, 25660);
});
