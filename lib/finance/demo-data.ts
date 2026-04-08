import { buildCompanySnapshot } from "@/lib/finance/parser";
import type { CompanyProfile, FinancialPeriod } from "@/lib/types";

const PROFILES: Record<string, Partial<CompanyProfile>> = {
  AAPL: {
    name: "Apple Inc.",
    sector: "Technology",
    industry: "Consumer Electronics",
    description: "Consumer hardware and services franchise with a large recurring ecosystem."
  },
  MSFT: {
    name: "Microsoft Corporation",
    sector: "Technology",
    industry: "Software Infrastructure",
    description: "Platform software business with cloud, productivity, and enterprise exposure."
  },
  NVDA: {
    name: "NVIDIA Corporation",
    sector: "Technology",
    industry: "Semiconductors",
    description: "Accelerated computing and AI infrastructure supplier with strong data-center mix."
  }
};

const QUARTER_ENDS = [
  "2026-03-31",
  "2025-12-31",
  "2025-09-30",
  "2025-06-30",
  "2025-03-31",
  "2024-12-31",
  "2024-09-30",
  "2024-06-30"
];

export function getDemoSnapshot(symbol: string) {
  const ticker = symbol.toUpperCase();
  const seed = [...ticker].reduce((total, char) => total + char.charCodeAt(0), 0);
  const quarterly = QUARTER_ENDS.map((date, index) => buildQuarter(ticker, date, index, seed));
  const annual = [0, 1, 2].map((yearOffset) =>
    buildAnnual(ticker, 2025 - yearOffset, quarterly.slice(yearOffset * 2, yearOffset * 2 + 4))
  );

  const profile: CompanyProfile = {
    symbol: ticker,
    name: PROFILES[ticker]?.name ?? `${ticker} Holdings`,
    exchange: "NASDAQ",
    sector: PROFILES[ticker]?.sector ?? "Financial Services",
    industry: PROFILES[ticker]?.industry ?? "Investment Research",
    description:
      PROFILES[ticker]?.description ??
      "Synthetic demo dataset used when an Alpha Vantage API key is not configured.",
    currency: "USD",
    marketCap: 40_000_000_000 + seed * 8_250_000,
    peRatio: 12 + (seed % 18),
    dividendYield: (seed % 4) / 100,
    beta: 0.9 + (seed % 7) / 10,
    analystTargetPrice: 90 + seed,
    fiftyTwoWeekRange: `${(55 + seed / 10).toFixed(2)} - ${(110 + seed / 8).toFixed(2)}`,
    nextEarningsDate: "2026-05-08",
    source: "demo"
  };

  return buildCompanySnapshot(profile, quarterly, annual);
}

function buildQuarter(symbol: string, date: string, index: number, seed: number): FinancialPeriod {
  const baseRevenue = 4_500_000_000 + seed * 18_000_000;
  const seasonality = [1.08, 1.02, 0.97, 0.94][index % 4];
  const growthFactor = 1 + (7 - index) * 0.028;
  const revenue = Math.round(baseRevenue * seasonality * growthFactor);
  const grossMargin = 0.48 + (seed % 6) * 0.01 - index * 0.003;
  const operatingMargin = grossMargin - 0.16;
  const netMargin = operatingMargin - 0.07;
  const grossProfit = Math.round(revenue * grossMargin);
  const operatingIncome = Math.round(revenue * operatingMargin);
  const netIncome = Math.round(revenue * netMargin);
  const operatingCashflow = Math.round(netIncome * 1.28);
  const capitalExpenditures = -Math.round(revenue * 0.065);
  const assets = Math.round(revenue * 4.4);
  const liabilities = Math.round(assets * (0.46 + (seed % 3) * 0.03));
  const equity = assets - liabilities;
  const shareCount = 1_150_000_000 + (seed % 80) * 1_000_000;

  return {
    fiscalDateEnding: date,
    reportedDate: new Date(new Date(date).getTime() + 1000 * 60 * 60 * 24 * 24)
      .toISOString()
      .slice(0, 10),
    totalRevenue: revenue,
    grossProfit,
    operatingIncome,
    netIncome,
    eps: Number((netIncome / shareCount).toFixed(2)),
    operatingCashflow,
    capitalExpenditures,
    freeCashFlow: operatingCashflow + capitalExpenditures,
    totalAssets: assets,
    totalLiabilities: liabilities,
    shareholderEquity: equity,
    cashAndShortTermInvestments: Math.round(revenue * 0.82),
    currentAssets: Math.round(assets * 0.37),
    currentLiabilities: Math.round(liabilities * 0.41),
    grossMargin,
    operatingMargin,
    netMargin,
    debtToEquity: liabilities / equity,
    currentRatio: (assets * 0.37) / (liabilities * 0.41),
    roe: netIncome / equity,
    revenueGrowth: index < QUARTER_ENDS.length - 4 ? 0.1 - index * 0.005 : null,
    ttmRevenue: null,
    ttmNetIncome: null,
    ttmFreeCashFlow: null
  };
}

function buildAnnual(symbol: string, year: number, quarters: FinancialPeriod[]): FinancialPeriod {
  const totalRevenue: number = sum(quarters.map((period) => period.totalRevenue));
  const grossProfit: number = sum(quarters.map((period) => period.grossProfit));
  const operatingIncome: number = sum(quarters.map((period) => period.operatingIncome));
  const netIncome: number = sum(quarters.map((period) => period.netIncome));
  const operatingCashflow: number = sum(quarters.map((period) => period.operatingCashflow));
  const capitalExpenditures: number = sum(quarters.map((period) => period.capitalExpenditures));
  const epsValues = quarters.flatMap((period) => (period.eps === null ? [] : [period.eps]));
  const latest = quarters[0] ?? buildQuarter(symbol, `${year}-12-31`, 0, 240);

  return {
    fiscalDateEnding: `${year}-12-31`,
    reportedDate: `${year + 1}-02-01`,
    totalRevenue,
    grossProfit,
    operatingIncome,
    netIncome,
    eps: epsValues.length
      ? Number((epsValues.reduce((total, value) => total + value, 0) / epsValues.length).toFixed(2))
      : null,
    operatingCashflow,
    capitalExpenditures,
    freeCashFlow: operatingCashflow + capitalExpenditures,
    totalAssets: latest.totalAssets,
    totalLiabilities: latest.totalLiabilities,
    shareholderEquity: latest.shareholderEquity,
    cashAndShortTermInvestments: latest.cashAndShortTermInvestments,
    currentAssets: latest.currentAssets,
    currentLiabilities: latest.currentLiabilities,
    grossMargin: ratio(grossProfit, totalRevenue),
    operatingMargin: ratio(operatingIncome, totalRevenue),
    netMargin: ratio(netIncome, totalRevenue),
    debtToEquity: ratio(latest.totalLiabilities, latest.shareholderEquity),
    currentRatio: ratio(latest.currentAssets, latest.currentLiabilities),
    roe: ratio(netIncome, latest.shareholderEquity),
    revenueGrowth: null,
    ttmRevenue: null,
    ttmNetIncome: null,
    ttmFreeCashFlow: null
  };
}

function sum(values: Array<number | null>): number {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

function ratio(numerator: number | null, denominator: number | null) {
  if (numerator === null || denominator === null || denominator === 0) {
    return null;
  }

  return numerator / denominator;
}
