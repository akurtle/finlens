import assert from "node:assert/strict";

import { buildFallbackAnalysis } from "../lib/finance/analysis.ts";
import { getDemoSnapshot } from "../lib/finance/demo-data.ts";
import { buildMetricCitation, getMetricDefinition } from "../lib/finance/lineage.ts";
import { buildCompanySnapshot } from "../lib/finance/parser.ts";
import type { CompanyProfile, FinancialPeriod } from "../lib/types.ts";

function baseProfile(): CompanyProfile {
  return {
    symbol: "TEST",
    name: "Test Corp",
    exchange: "NASDAQ",
    sector: "Technology",
    industry: "Software",
    description: "Synthetic profile for parser tests.",
    currency: "USD",
    marketCap: 1_000_000_000,
    peRatio: 18,
    dividendYield: null,
    beta: 1.2,
    analystTargetPrice: 120,
    fiftyTwoWeekRange: "80 - 130",
    nextEarningsDate: "2026-05-01",
    source: "demo"
  };
}

function makeQuarter(
  date: string,
  revenue: number,
  grossProfit: number,
  opIncome: number,
  netIncome: number
): FinancialPeriod {
  return {
    fiscalDateEnding: date,
    reportedDate: date,
    totalRevenue: revenue,
    grossProfit,
    operatingIncome: opIncome,
    netIncome,
    eps: 1.2,
    operatingCashflow: 260,
    capitalExpenditures: -40,
    freeCashFlow: 220,
    totalAssets: 2_000,
    totalLiabilities: 900,
    shareholderEquity: 1_100,
    cashAndShortTermInvestments: 300,
    currentAssets: 800,
    currentLiabilities: 400,
    grossMargin: null,
    operatingMargin: null,
    netMargin: null,
    debtToEquity: null,
    currentRatio: null,
    roe: null,
    revenueGrowth: null
  };
}

function runParserAssertions() {
  const snapshot = buildCompanySnapshot(
    baseProfile(),
    [
      makeQuarter("2026-03-31", 1000, 500, 220, 150),
      makeQuarter("2025-12-31", 960, 451, 210, 140),
      makeQuarter("2025-09-30", 930, 428, 205, 132),
      makeQuarter("2025-06-30", 910, 418, 198, 126),
      makeQuarter("2025-03-31", 880, 396, 184, 118)
    ],
    []
  );

  assert.ok(snapshot.quarterly[0]);
  assert.ok(snapshot.metrics[0]);
  assert.ok(Math.abs(snapshot.quarterly[0].grossMargin! - 0.5) < 0.0001);
  assert.ok(Math.abs(snapshot.quarterly[0].operatingMargin! - 0.22) < 0.0001);
  assert.equal(snapshot.quarterly[0].freeCashFlow, 220);
  assert.ok(Math.abs(snapshot.quarterly[0].debtToEquity! - 900 / 1100) < 0.0001);
  assert.ok(Math.abs(snapshot.quarterly[0].currentRatio! - 2) < 0.0001);
  assert.ok(Math.abs(snapshot.quarterly[0].revenueGrowth! - (1000 - 880) / 880) < 0.0001);
  assert.equal(snapshot.metrics[0].value, 1000);
}

function runLineageAssertions() {
  const period: FinancialPeriod = {
    fiscalDateEnding: "2026-03-31",
    reportedDate: "2026-04-22",
    totalRevenue: 1000,
    grossProfit: 550,
    operatingIncome: 240,
    netIncome: 170,
    eps: 1.4,
    operatingCashflow: 260,
    capitalExpenditures: -35,
    freeCashFlow: 225,
    totalAssets: 2200,
    totalLiabilities: 880,
    shareholderEquity: 1320,
    cashAndShortTermInvestments: 420,
    currentAssets: 900,
    currentLiabilities: 450,
    grossMargin: 0.55,
    operatingMargin: 0.24,
    netMargin: 0.17,
    debtToEquity: 880 / 1320,
    currentRatio: 2,
    roe: 170 / 1320,
    revenueGrowth: 0.12
  };

  const citation = buildMetricCitation(period, "grossMargin");
  assert.equal(citation.formula, "grossProfit / totalRevenue");
  assert.deepEqual(citation.inputs, [
    { label: "Gross Profit", value: "$550.00" },
    { label: "Revenue", value: "$1,000.00" }
  ]);
  assert.match(getMetricDefinition("freeCashFlow").formula, /operatingCashflow/);
}

function runAnalysisAssertions() {
  const snapshot = getDemoSnapshot("AAPL");
  const response = buildFallbackAnalysis("What was the gross margin trend over 8 quarters?", snapshot);

  assert.match(response.answer, /AAPL/);
  assert.ok(response.citations.length > 0);
  assert.equal(response.citations[0]?.formula, "grossProfit / totalRevenue");
  assert.ok((response.citations[0]?.inputs.length ?? 0) > 0);
  assert.match(response.keyPoints[2] ?? "", /Formula:/);
}

runParserAssertions();
runLineageAssertions();
runAnalysisAssertions();

console.log("All financial parsing and analysis assertions passed.");
