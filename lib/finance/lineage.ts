import type { FinancialPeriod, SourceCitation, TrendMetric, TrendMetricKey } from "@/lib/types";
import { formatMetric } from "@/lib/utils";

type MetricDefinition = {
  key: TrendMetricKey;
  label: string;
  format: TrendMetric["format"];
  formula: string;
  inputs: Array<{
    label: string;
    field: keyof FinancialPeriod;
    format: TrendMetric["format"] | "currency";
  }>;
};

const METRIC_DEFINITIONS: Record<TrendMetricKey, MetricDefinition> = {
  totalRevenue: {
    key: "totalRevenue",
    label: "Revenue",
    format: "currency",
    formula: "Reported totalRevenue field from the income statement.",
    inputs: [{ label: "Revenue", field: "totalRevenue", format: "currency" }]
  },
  grossMargin: {
    key: "grossMargin",
    label: "Gross Margin",
    format: "percent",
    formula: "grossProfit / totalRevenue",
    inputs: [
      { label: "Gross Profit", field: "grossProfit", format: "currency" },
      { label: "Revenue", field: "totalRevenue", format: "currency" }
    ]
  },
  operatingMargin: {
    key: "operatingMargin",
    label: "Operating Margin",
    format: "percent",
    formula: "operatingIncome / totalRevenue",
    inputs: [
      { label: "Operating Income", field: "operatingIncome", format: "currency" },
      { label: "Revenue", field: "totalRevenue", format: "currency" }
    ]
  },
  netIncome: {
    key: "netIncome",
    label: "Net Income",
    format: "currency",
    formula: "Reported netIncome field from the income statement.",
    inputs: [{ label: "Net Income", field: "netIncome", format: "currency" }]
  },
  eps: {
    key: "eps",
    label: "EPS",
    format: "number",
    formula: "Reported diluted EPS field for the period.",
    inputs: [{ label: "EPS", field: "eps", format: "number" }]
  },
  freeCashFlow: {
    key: "freeCashFlow",
    label: "Free Cash Flow",
    format: "currency",
    formula: "operatingCashflow - capitalExpenditures, preserving Alpha Vantage sign conventions.",
    inputs: [
      { label: "Operating Cash Flow", field: "operatingCashflow", format: "currency" },
      { label: "Capital Expenditures", field: "capitalExpenditures", format: "currency" }
    ]
  },
  currentRatio: {
    key: "currentRatio",
    label: "Current Ratio",
    format: "multiple",
    formula: "currentAssets / currentLiabilities",
    inputs: [
      { label: "Current Assets", field: "currentAssets", format: "currency" },
      { label: "Current Liabilities", field: "currentLiabilities", format: "currency" }
    ]
  },
  debtToEquity: {
    key: "debtToEquity",
    label: "Debt / Equity",
    format: "multiple",
    formula: "totalLiabilities / shareholderEquity",
    inputs: [
      { label: "Total Liabilities", field: "totalLiabilities", format: "currency" },
      { label: "Shareholder Equity", field: "shareholderEquity", format: "currency" }
    ]
  },
  roe: {
    key: "roe",
    label: "ROE",
    format: "percent",
    formula: "netIncome / shareholderEquity",
    inputs: [
      { label: "Net Income", field: "netIncome", format: "currency" },
      { label: "Shareholder Equity", field: "shareholderEquity", format: "currency" }
    ]
  }
};

export function getMetricDefinition(metric: TrendMetricKey) {
  return METRIC_DEFINITIONS[metric];
}

export function buildMetricCitation(period: FinancialPeriod, metric: TrendMetricKey): SourceCitation {
  const definition = getMetricDefinition(metric);

  return {
    label: `${period.fiscalDateEnding} ${definition.label}`,
    detail: `${definition.label} was ${formatMetric(period[metric], definition.format, {
      compact: false
    })}.`,
    source: "Parsed financial dataset",
    period: period.fiscalDateEnding,
    metric: definition.label,
    value: formatMetric(period[metric], definition.format, { compact: false }),
    formula: definition.formula,
    inputs: definition.inputs.map((input) => ({
      label: input.label,
      value: formatMetric(period[input.field] as number | null, input.format, { compact: false })
    }))
  };
}
