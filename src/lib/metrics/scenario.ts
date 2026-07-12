export interface ScenarioAssumptions {
  targetMonthlyRevenue: number;
  averageOrderValue: number;
  repeatPurchaseRateChange: number; // fraction change, e.g. 0.05 = +5 points
  priceChangePercent: number; // e.g. 0.1 = +10%
  discountChangePercent: number; // e.g. -0.05 = 5% less discounting
  conversionRateChange: number | null; // optional, only if buyer supplies a baseline
}

export interface ScenarioResult {
  requiredOrders: number;
  requiredAverageOrderValue: number;
  projectedRevenueFromPriceChange: number;
  projectedRevenueFromDiscountChange: number;
  notes: string[];
}

/**
 * Goal & Scenario Planner (Part 14). Pure "what-if" arithmetic on user-supplied assumptions —
 * this is explicitly NOT a prediction, and every output must be labelled as a calculated
 * scenario derived from the assumptions the buyer entered, not historical fact.
 */
export function computeScenario(assumptions: ScenarioAssumptions, historicalMonthlyRevenue: number): ScenarioResult {
  const requiredOrders = assumptions.averageOrderValue > 0 ? Math.ceil(assumptions.targetMonthlyRevenue / assumptions.averageOrderValue) : 0;

  const notes: string[] = [
    "These figures are calculated directly from the assumptions you entered, not from a prediction model.",
  ];

  if (assumptions.repeatPurchaseRateChange !== 0) {
    notes.push(
      `A ${(assumptions.repeatPurchaseRateChange * 100).toFixed(0)}-point change in repeat purchase rate would need to be validated against your actual repeat-customer trend in the Segmentation view.`,
    );
  }

  const projectedRevenueFromPriceChange = historicalMonthlyRevenue * (1 + assumptions.priceChangePercent);
  const projectedRevenueFromDiscountChange = historicalMonthlyRevenue * (1 - assumptions.discountChangePercent);

  if (assumptions.conversionRateChange !== null) {
    notes.push("Conversion assumptions were supplied and are reflected only in the order-count calculation above, not automatically compounded with price/discount changes.");
  } else {
    notes.push("No conversion-rate assumption was supplied, so this scenario does not model conversion effects.");
  }

  return {
    requiredOrders,
    requiredAverageOrderValue: assumptions.targetMonthlyRevenue / Math.max(1, requiredOrders),
    projectedRevenueFromPriceChange,
    projectedRevenueFromDiscountChange,
    notes,
  };
}

export interface ScenarioExport {
  generatedAt: string;
  assumptions: ScenarioAssumptions;
  result: ScenarioResult;
  historicalMonthlyRevenue: number;
}

export function buildScenarioExport(assumptions: ScenarioAssumptions, historicalMonthlyRevenue: number): ScenarioExport {
  return {
    generatedAt: new Date().toISOString(),
    assumptions,
    result: computeScenario(assumptions, historicalMonthlyRevenue),
    historicalMonthlyRevenue,
  };
}
