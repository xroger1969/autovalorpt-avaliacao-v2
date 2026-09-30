// Comparador Auto Pro — motor de valorização V1
// Núcleo determinístico e auditável. Sem chamadas a IA neste ficheiro.

const DEFAULT_CONFIG = Object.freeze({
  weights: {
    identity: 25,
    powertrain: 20,
    year: 15,
    mileage: 15,
    performance: 10,
    equipment: 7,
    commercial: 5,
    freshness: 3,
  },
  minSimilarity: 55,
  excellentSimilarity: 88,
  negotiationDiscountPct: 0.025,
  fastSaleDiscountPct: 0.045,
  riskReservePct: 0.01,
  kmAdjustmentPer1000: 35,
  ageAdjustmentPerMonth: 85,
  equipmentUnitAdjustment: 180,
  minimumMargin: 1800,
  targetMargin: 3000,
});

const num = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const normText = (v) => String(v ?? "").trim().toLowerCase();

function same(a, b) {
  return normText(a) && normText(a) === normText(b);
}

function monthIndex(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

function ageMonthDelta(subject, comp) {
  const a = monthIndex(subject.first_registration || subject.date);
  const b = monthIndex(comp.first_registration || comp.date);
  if (a == null || b == null) {
    if (subject.year && comp.year) return (num(subject.year) - num(comp.year)) * 12;
    return 0;
  }
  return a - b;
}

function list(v) {
  return Array.isArray(v) ? v.map(normText).filter(Boolean) : [];
}

function jaccard(a, b) {
  const A = new Set(list(a));
  const B = new Set(list(b));
  if (!A.size && !B.size) return 1;
  const inter = [...A].filter(x => B.has(x)).length;
  const union = new Set([...A, ...B]).size || 1;
  return inter / union;
}

function hardExclusion(subject, comp) {
  if (!same(subject.make, comp.make)) return "marca diferente";
  if (!same(subject.model, comp.model)) return "modelo diferente";
  if (subject.body_type && comp.body_type && !same(subject.body_type, comp.body_type)) return "carroçaria diferente";
  if (subject.fuel && comp.fuel && !same(subject.fuel, comp.fuel)) return "combustível diferente";

  if (subject.generation && comp.generation && !same(subject.generation, comp.generation)) {
    return "geração diferente";
  }

  const sb = num(subject.battery_kwh, NaN);
  const cb = num(comp.battery_kwh, NaN);
  if (Number.isFinite(sb) && Number.isFinite(cb) && Math.abs(sb - cb) >= 12) {
    return "bateria incompatível";
  }

  return null;
}

export function similarity(subject, comp, config = DEFAULT_CONFIG) {
  const w = config.weights;
  let score = 0;

  // Identidade/versão
  let identity = 0.45;
  if (subject.generation && comp.generation) identity += same(subject.generation, comp.generation) ? 0.25 : -0.25;
  if (subject.trim && comp.trim) identity += same(subject.trim, comp.trim) ? 0.30 : 0;
  score += w.identity * clamp(identity, 0, 1);

  // Motorização/bateria
  let powertrain = 0.5;
  if (same(subject.fuel, comp.fuel)) powertrain += 0.2;
  if (subject.battery_kwh && comp.battery_kwh) {
    const diff = Math.abs(num(subject.battery_kwh) - num(comp.battery_kwh));
    powertrain += clamp(1 - diff / 15, 0, 1) * 0.3;
  } else if (subject.engine_cc && comp.engine_cc) {
    const diff = Math.abs(num(subject.engine_cc) - num(comp.engine_cc));
    powertrain += clamp(1 - diff / 800, 0, 1) * 0.3;
  }
  score += w.powertrain * clamp(powertrain, 0, 1);

  // Ano
  const yearDiff = Math.abs(num(subject.year) - num(comp.year));
  score += w.year * clamp(1 - yearDiff / 5, 0, 1);

  // Km
  const kmDiff = Math.abs(num(subject.mileage_km) - num(comp.mileage_km));
  score += w.mileage * clamp(1 - kmDiff / 90000, 0, 1);

  // Potência / tração
  let perf = 0.55;
  if (subject.power_cv && comp.power_cv) {
    const diff = Math.abs(num(subject.power_cv) - num(comp.power_cv));
    perf += clamp(1 - diff / 180, 0, 1) * 0.30;
  }
  if (subject.drivetrain && comp.drivetrain) perf += same(subject.drivetrain, comp.drivetrain) ? 0.15 : 0;
  score += w.performance * clamp(perf, 0, 1);

  // Equipamento
  score += w.equipment * jaccard(subject.equipment, comp.equipment);

  // IVA/origem/garantia
  let commercial = 0.45;
  if (subject.vat_deductible != null && comp.vat_deductible != null) commercial += subject.vat_deductible === comp.vat_deductible ? 0.2 : 0;
  if (subject.origin && comp.origin) commercial += same(subject.origin, comp.origin) ? 0.15 : 0;
  if (subject.warranty_months != null && comp.warranty_months != null) {
    const d = Math.abs(num(subject.warranty_months) - num(comp.warranty_months));
    commercial += clamp(1 - d / 36, 0, 1) * 0.2;
  }
  score += w.commercial * clamp(commercial, 0, 1);

  // Recência
  const daysOld = Math.max(0, num(comp.days_since_seen, 30));
  score += w.freshness * clamp(1 - daysOld / 180, 0, 1);

  return Math.round(clamp(score, 0, 100) * 10) / 10;
}

function adjustPrice(subject, comp, config) {
  let adjusted = num(comp.price);

  // Mais km no alvo => alvo vale menos; menos km => vale mais.
  const kmDelta = num(comp.mileage_km) - num(subject.mileage_km);
  adjusted += (kmDelta / 1000) * config.kmAdjustmentPer1000;

  // Alvo mais novo => vale mais.
  const months = ageMonthDelta(subject, comp);
  adjusted += (-months) * config.ageAdjustmentPerMonth;

  // Ajuste simples de equipamento; será substituído por coeficientes aprendidos.
  const s = new Set(list(subject.equipment));
  const c = new Set(list(comp.equipment));
  const missingOnComp = [...s].filter(x => !c.has(x)).length;
  const extraOnComp = [...c].filter(x => !s.has(x)).length;
  adjusted += (missingOnComp - extraOnComp) * config.equipmentUnitAdjustment;

  return Math.round(adjusted);
}

function quartiles(values) {
  const a = [...values].sort((x, y) => x - y);
  const q = p => {
    if (!a.length) return NaN;
    const pos = (a.length - 1) * p;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    if (lo === hi) return a[lo];
    return a[lo] + (a[hi] - a[lo]) * (pos - lo);
  };
  return { q1: q(0.25), q2: q(0.5), q3: q(0.75) };
}

function weightedMedian(rows) {
  const a = [...rows].sort((x, y) => x.value - y.value);
  const total = a.reduce((s, x) => s + x.weight, 0);
  if (!total) return NaN;
  let acc = 0;
  for (const x of a) {
    acc += x.weight;
    if (acc >= total / 2) return x.value;
  }
  return a.at(-1).value;
}

function confidence(valid, marketValue, subject) {
  if (!valid.length || !Number.isFinite(marketValue)) return 0;

  const countScore = clamp(valid.length / 18, 0, 1);
  const similarityScore = valid.reduce((s, x) => s + x.similarity, 0) / valid.length / 100;

  const prices = valid.map(x => x.adjustedPrice);
  const q = quartiles(prices);
  const spreadPct = marketValue ? (q.q3 - q.q1) / marketValue : 1;
  const dispersionScore = clamp(1 - spreadPct / 0.28, 0, 1);

  const freshnessScore = valid.reduce((s, x) => s + clamp(1 - num(x.comp.days_since_seen, 30) / 180, 0, 1), 0) / valid.length;

  const essential = ["make","model","year","mileage_km","fuel","price"];
  const completeness = essential.filter(k => subject[k] !== undefined && subject[k] !== null && subject[k] !== "").length / essential.length;

  return Math.round(100 * (
    countScore * 0.24 +
    similarityScore * 0.28 +
    dispersionScore * 0.22 +
    freshnessScore * 0.12 +
    completeness * 0.14
  ));
}

function riskReserve({ saleLikely, riskFlags = [], confidencePct }, config) {
  const base = saleLikely * config.riskReservePct;
  const flagPenalty = riskFlags.reduce((sum, f) => sum + num(f.reserve_eur), 0);
  const lowConfidencePenalty = confidencePct < 60 ? saleLikely * 0.02 : confidencePct < 75 ? saleLikely * 0.01 : 0;
  return Math.round(base + flagPenalty + lowConfidencePenalty);
}

export function evaluatePurchase(input, customConfig = {}) {
  const config = {
    ...DEFAULT_CONFIG,
    ...customConfig,
    weights: { ...DEFAULT_CONFIG.weights, ...(customConfig.weights || {}) },
  };

  const subject = input.subject || {};
  const comps = Array.isArray(input.comparables) ? input.comparables : [];

  const excluded = [];
  const candidates = [];

  for (const comp of comps) {
    const reason = hardExclusion(subject, comp);
    if (reason) {
      excluded.push({ comp, reason });
      continue;
    }

    const sim = similarity(subject, comp, config);
    if (sim < config.minSimilarity) {
      excluded.push({ comp, reason: `semelhança insuficiente (${sim}%)` });
      continue;
    }

    candidates.push({
      comp,
      similarity: sim,
      adjustedPrice: adjustPrice(subject, comp, config),
    });
  }

  // Outliers por IQR sobre preços já ajustados.
  const prices = candidates.map(x => x.adjustedPrice);
  let filtered = candidates;
  if (prices.length >= 5) {
    const { q1, q3 } = quartiles(prices);
    const iqr = q3 - q1;
    const lo = q1 - 1.5 * iqr;
    const hi = q3 + 1.5 * iqr;
    filtered = [];
    for (const x of candidates) {
      if (x.adjustedPrice < lo || x.adjustedPrice > hi) {
        excluded.push({ comp: x.comp, reason: "outlier de preço" });
      } else {
        filtered.push(x);
      }
    }
  }

  const weighted = filtered.map(x => ({
    value: x.adjustedPrice,
    weight: Math.pow(x.similarity / 100, 2),
  }));

  const marketValue = Math.round(weightedMedian(weighted));
  const confidencePct = confidence(filtered, marketValue, subject);

  const negotiationPct = num(input.negotiation_discount_pct, config.negotiationDiscountPct);
  const fastPct = num(input.fast_sale_discount_pct, config.fastSaleDiscountPct);

  const saleLikely = Number.isFinite(marketValue)
    ? Math.round(marketValue * (1 - negotiationPct))
    : NaN;

  const saleFast = Number.isFinite(saleLikely)
    ? Math.round(saleLikely * (1 - fastPct))
    : NaN;

  const costs = input.costs || {};
  const fixedCosts =
    num(costs.auction_fee) +
    num(costs.transport) +
    num(costs.registration) +
    num(costs.reconditioning) +
    num(costs.warranty_reserve) +
    num(costs.stock_finance) +
    num(costs.other);

  const reserve = Number.isFinite(saleLikely)
    ? riskReserve({
        saleLikely,
        riskFlags: input.risk_flags || [],
        confidencePct,
      }, config)
    : NaN;

  const targetMargin = num(input.target_margin, config.targetMargin);
  const minimumMargin = num(input.minimum_margin, config.minimumMargin);

  const maxPurchase = Number.isFinite(saleLikely)
    ? Math.round(saleLikely - fixedCosts - reserve - targetMargin)
    : NaN;

  const absoluteMax = Number.isFinite(saleLikely)
    ? Math.round(saleLikely - fixedCosts - reserve - minimumMargin)
    : NaN;

  const currentPrice = num(input.current_purchase_price, NaN);
  const expectedMargin = Number.isFinite(currentPrice) && Number.isFinite(saleLikely)
    ? Math.round(saleLikely - currentPrice - fixedCosts - reserve)
    : NaN;

  let decision = "sem dados";
  if (Number.isFinite(currentPrice) && Number.isFinite(maxPurchase) && Number.isFinite(absoluteMax)) {
    if (currentPrice <= maxPurchase * 0.97) decision = "compra muito interessante";
    else if (currentPrice <= maxPurchase) decision = "boa compra";
    else if (currentPrice <= absoluteMax) decision = "comprar só com justificação";
    else decision = "não comprar";
  }

  return {
    subject,
    market: {
      comparablesReceived: comps.length,
      comparablesUsed: filtered.length,
      comparablesExcluded: excluded.length,
      marketValue,
      saleLikely,
      saleFast,
      confidencePct,
    },
    purchase: {
      currentPrice,
      fixedCosts: Math.round(fixedCosts),
      riskReserve: reserve,
      targetMargin,
      minimumMargin,
      maxPurchase,
      absoluteMax,
      expectedMargin,
      decision,
    },
    comparables: filtered
      .sort((a, b) => b.similarity - a.similarity)
      .map(x => ({
        url: x.comp.url,
        price: num(x.comp.price),
        adjustedPrice: x.adjustedPrice,
        similarity: x.similarity,
        year: x.comp.year,
        mileage_km: x.comp.mileage_km,
        trim: x.comp.trim,
      })),
    excluded: excluded.map(x => ({
      url: x.comp?.url,
      price: num(x.comp?.price, null),
      reason: x.reason,
    })),
    warnings: [
      ...(filtered.length < 5 ? ["Poucos comparáveis válidos; avaliação deve ser revista manualmente."] : []),
      ...(confidencePct < 60 ? ["Confiança baixa; não usar o máximo de compra como valor automático de licitação."] : []),
    ],
  };
}

export { DEFAULT_CONFIG };
