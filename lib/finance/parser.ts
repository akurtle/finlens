import type {
  CompanyProfile,
  CompanySnapshot,
  DashboardMetric,
  FinancialPeriod,
  TrendMetric
} from "@/lib/types";

export const AVAILABLE_METRICS: TrendMetric[] = [
  {
    key: "totalRevenue",
    label: "Revenue",
    format: "currency",
    description: "Top-line revenue by quarter.",
    formula: "Reported totalRevenue field from the income statement."
  },
  {
    key: "grossMargin",
    label: "Gross Margin",
    format: "percent",
    description: "Gross profit divided by revenue.",
    formula: "grossProfit / totalRevenue"
  },
  {
    key: "operatingMargin",
    label: "Operating Margin",
    format: "percent",
    description: "Operating income divided by revenue.",
    formula: "operatingIncome / totalRevenue"
  },
  {
    key: "netIncome",
    label: "Net Income",
    format: "currency",
    description: "Bottom-line profitability by quarter.",
    formula: "Reported netIncome field from the income statement."
  },
  {
    key: "eps",
    label: "EPS",
    format: "number",
    description: "Diluted earnings per share.",
    formula: "Reported diluted EPS field for the period."
  },
  {
    key: "freeCashFlow",
    label: "Free Cash Flow",
    format: "currency",
    description: "Operating cash flow less capital spending.",
    formula: "operatingCashflow - capitalExpenditures"
  },
  {
    key: "currentRatio",
    label: "Current Ratio",
    format: "multiple",
    description: "Current assets divided by current liabilities.",
    formula: "currentAssets / currentLiabilities"
  },
  {
    key: "debtToEquity",
    label: "Debt / Equity",
    format: "multiple",
    description: "Total liabilities divided by shareholder equity.",
    formula: "totalLiabilities / shareholderEquity"
  },
  {
    key: "roe",
    label: "ROE",
    format: "percent",
    description: "Net income divided by shareholder equity.",
    formula: "netIncome / shareholderEquity"
  }
];

type ReportMap = Record<string, Record<string, string>>;

type AlphaVantageSnapshotInput = {
  overview: Record<string, string>;
  income: { quarterlyReports?: Record<string, string>[]; annualReports?: Record<string, string>[] };
  balance: { quarterlyReports?: Record<string, string>[]; annualReports?: Record<string, string>[] };
  cashflow: { quarterlyReports?: Record<string, string>[]; annualReports?: Record<string, string>[] };
  earnings: { quarterlyEarnings?: Record<string, string>[] };
};

const EMPTY_PERIOD: Omit<FinancialPeriod, "fiscalDateEnding"> = {
  reportedDate: null,
  totalRevenue: null,
  grossProfit: null,
  operatingIncome: null,
  netIncome: null,
  eps: null,
  operatingCashflow: null,
  capitalExpenditures: null,
  freeCashFlow: null,
  totalAssets: null,
  totalLiabilities: null,
  shareholderEquity: null,
  cashAndShortTermInvestments: null,
  currentAssets: null,
  currentLiabilities: null,
  grossMargin: null,
  operatingMargin: null,
  netMargin: null,
  debtToEquity: null,
  currentRatio: null,
  roe: null,
  revenueGrowth: null
};

export function parseAlphaVantageSnapshot(input: AlphaVantageSnapshotInput): CompanySnapshot {
  const profile = buildProfile(input.overview);
  const earningsMap = toDateMap(input.earnings.quarterlyEarnings ?? []);
  const quarterly = buildPeriods(
    input.income.quarterlyReports ?? [],
    input.balance.quarterlyReports ?? [],
    input.cashflow.quarterlyReports ?? [],
    earningsMap
  );
  const annual = buildPeriods(
    input.income.annualReports ?? [],
    input.balance.annualReports ?? [],
    input.cashflow.annualReports ?? [],
    {}
  );

  return {
    profile,
    quarterly,
    annual,
    metrics: buildMetrics(quarterly),
    availableMetrics: AVAILABLE_METRICS
  };
}

export function buildCompanySnapshot(
  profile: CompanyProfile,
  quarterly: FinancialPeriod[],
  annual: FinancialPeriod[]
): CompanySnapshot {
  return {
    profile,
    quarterly: decoratePeriods(quarterly),
    annual: decoratePeriods(annual),
    metrics: buildMetrics(quarterly),
    availableMetrics: AVAILABLE_METRICS
  };
}

function buildProfile(overview: Record<string, string>): CompanyProfile {
  return {
    symbol: (overview.Symbol ?? "N/A").toUpperCase(),
    name: overview.Name ?? overview.Symbol ?? "Unknown Company",
    exchange: overview.Exchange ?? null,
    sector: overview.Sector ?? null,
    industry: overview.Industry ?? null,
    description: overview.Description ?? null,
    currency: overview.Currency ?? "USD",
    marketCap: toNumber(overview.MarketCapitalization),
    peRatio: toNumber(overview.PERatio),
    dividendYield: toNumber(overview.DividendYield),
    beta: toNumber(overview.Beta),
    analystTargetPrice: toNumber(overview.AnalystTargetPrice),
    fiftyTwoWeekRange:
      overview["52WeekLow"] && overview["52WeekHigh"]
        ? `${overview["52WeekLow"]} - ${overview["52WeekHigh"]}`
        : null,
    nextEarningsDate: overview.ExDividendDate ?? null,
    source: "alpha-vantage"
  };
}

function buildPeriods(
  incomeReports: Record<string, string>[],
  balanceReports: Record<string, string>[],
  cashflowReports: Record<string, string>[],
  earningsMap: ReportMap
) {
  const periods = new Map<string, FinancialPeriod>();

  for (const report of incomeReports) {
    const date = report.fiscalDateEnding;
    if (!date) {
      continue;
    }

    periods.set(date, {
      fiscalDateEnding: date,
      ...EMPTY_PERIOD,
      totalRevenue: toNumber(report.totalRevenue),
      grossProfit: toNumber(report.grossProfit),
      operatingIncome: toNumber(report.operatingIncome),
      netIncome: toNumber(report.netIncome),
      eps: toNumber(report.reportedEPS)
    });
  }

  for (const report of balanceReports) {
    const existing = periods.get(report.fiscalDateEnding);
    if (!existing) {
      continue;
    }

    existing.totalAssets = toNumber(report.totalAssets);
    existing.totalLiabilities = toNumber(report.totalLiabilities);
    existing.shareholderEquity =
      toNumber(report.totalShareholderEquity) ?? toNumber(report.totalStockholdersEquity);
    existing.cashAndShortTermInvestments = toNumber(report.cashAndShortTermInvestmentsAtCarryingValue);
    existing.currentAssets = toNumber(report.totalCurrentAssets);
    existing.currentLiabilities = toNumber(report.totalCurrentLiabilities);
  }

  for (const report of cashflowReports) {
    const existing = periods.get(report.fiscalDateEnding);
    if (!existing) {
      continue;
    }

    existing.operatingCashflow = toNumber(report.operatingCashflow);
    existing.capitalExpenditures = toNumber(report.capitalExpenditures);
  }

  for (const [date, earnings] of Object.entries(earningsMap)) {
    const existing = periods.get(date);
    if (!existing) {
      continue;
    }

    existing.reportedDate = earnings.reportedDate ?? null;
    existing.eps = existing.eps ?? toNumber(earnings.reportedEPS);
  }

  return decoratePeriods(Array.from(periods.values()));
}

function decoratePeriods(periods: FinancialPeriod[]) {
  const sorted = [...periods].sort(
    (left, right) =>
      new Date(right.fiscalDateEnding).getTime() - new Date(left.fiscalDateEnding).getTime()
  );

  return sorted.map((period, index) => {
    const yearAgo = sorted[index + 4];
    const freeCashFlow =
      period.operatingCashflow === null || period.capitalExpenditures === null
        ? null
        : period.capitalExpenditures < 0
          ? period.operatingCashflow + period.capitalExpenditures
          : period.operatingCashflow - period.capitalExpenditures;

    const grossMargin = ratio(period.grossProfit, period.totalRevenue);
    const operatingMargin = ratio(period.operatingIncome, period.totalRevenue);
    const netMargin = ratio(period.netIncome, period.totalRevenue);
    const debtToEquity = ratio(period.totalLiabilities, period.shareholderEquity);
    const currentRatio = ratio(period.currentAssets, period.currentLiabilities);
    const roe = ratio(period.netIncome, period.shareholderEquity);
    const revenueGrowth = yearAgo
      ? change(period.totalRevenue, yearAgo.totalRevenue)
      : null;

    return {
      ...period,
      freeCashFlow,
      grossMargin,
      operatingMargin,
      netMargin,
      debtToEquity,
      currentRatio,
      roe,
      revenueGrowth
    };
  });
}

function buildMetrics(quarterly: FinancialPeriod[]): DashboardMetric[] {
  const latest = quarterly[0];
  const previous = quarterly[1];
  const yearAgo = quarterly[4];

  if (!latest) {
    return [];
  }

  return [
    {
      id: "revenue",
      label: "Quarter Revenue",
      value: latest.totalRevenue,
      format: "currency",
      change: change(latest.totalRevenue, yearAgo?.totalRevenue ?? null),
      changeLabel: "vs 1Y ago"
    },
    {
      id: "gross-margin",
      label: "Gross Margin",
      value: latest.grossMargin,
      format: "percent",
      change: change(latest.grossMargin, previous?.grossMargin ?? null),
      changeLabel: "vs prev qtr"
    },
    {
      id: "fcf",
      label: "Free Cash Flow",
      value: latest.freeCashFlow,
      format: "currency",
      change: change(latest.freeCashFlow, yearAgo?.freeCashFlow ?? null),
      changeLabel: "vs 1Y ago"
    },
    {
      id: "net-margin",
      label: "Net Margin",
      value: latest.netMargin,
      format: "percent",
      change: change(latest.netMargin, previous?.netMargin ?? null),
      changeLabel: "vs prev qtr"
    },
    {
      id: "debt-to-equity",
      label: "Debt / Equity",
      value: latest.debtToEquity,
      format: "multiple",
      change: change(latest.debtToEquity, previous?.debtToEquity ?? null),
      changeLabel: "vs prev qtr"
    },
    {
      id: "roe",
      label: "ROE",
      value: latest.roe,
      format: "percent",
      change: change(latest.roe, yearAgo?.roe ?? null),
      changeLabel: "vs 1Y ago"
    }
  ];
}

function toDateMap(reports: Record<string, string>[]) {
  return reports.reduce<ReportMap>((accumulator, report) => {
    if (report.fiscalDateEnding) {
      accumulator[report.fiscalDateEnding] = report;
    }
    return accumulator;
  }, {});
}

function toNumber(value: string | undefined) {
  if (!value || value === "None" || value === "-" || value === "null") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function ratio(numerator: number | null, denominator: number | null) {
  if (numerator === null || denominator === null || denominator === 0) {
    return null;
  }

  return numerator / denominator;
}

function change(current: number | null, baseline: number | null) {
  if (current === null || baseline === null || baseline === 0) {
    return null;
  }

  return (current - baseline) / Math.abs(baseline);
}
