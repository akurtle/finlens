import type { AnalysisResponse, CompanySnapshot, SourceCitation, TrendMetricKey } from "@/lib/types";
import { formatMetric } from "@/lib/utils";

const METRIC_KEYWORDS: Array<{ key: TrendMetricKey; keywords: string[]; label: string }> = [
  { key: "grossMargin", keywords: ["gross margin", "margin"], label: "gross margin" },
  { key: "totalRevenue", keywords: ["revenue", "sales", "top line"], label: "revenue" },
  { key: "freeCashFlow", keywords: ["free cash flow", "fcf", "cash flow"], label: "free cash flow" },
  { key: "netIncome", keywords: ["net income", "profit", "earnings"], label: "net income" },
  { key: "debtToEquity", keywords: ["debt", "leverage", "debt to equity"], label: "debt to equity" },
  { key: "roe", keywords: ["roe", "return on equity"], label: "return on equity" },
  { key: "eps", keywords: ["eps", "earnings per share"], label: "EPS" }
];

export function buildFallbackAnalysis(question: string, snapshot: CompanySnapshot): AnalysisResponse {
  const selected = pickMetric(question);
  const periods = snapshot.quarterly.slice(0, 8);
  const values = periods
    .map((period) => ({
      period,
      value: period[selected.key]
    }))
    .filter((entry): entry is { period: CompanySnapshot["quarterly"][number]; value: number } => entry.value !== null);

  if (!values.length) {
    return {
      answer: `FinLens could not find enough ${selected.label} datapoints for ${snapshot.profile.symbol}.`,
      keyPoints: ["Try another ticker or connect a live Alpha Vantage API key."],
      citations: [],
      confidence: "low"
    };
  }

  const latest = values[0];
  const oldest = values[values.length - 1];
  const delta = latest.value - oldest.value;
  const direction = Math.abs(delta) < Math.abs(oldest.value) * 0.02 ? "stable" : delta > 0 ? "improved" : "compressed";

  const answer =
    selected.key === "grossMargin"
      ? `${snapshot.profile.symbol} ${direction === "stable" ? "held" : direction} gross margin across the last ${values.length} reported quarters, reaching ${formatMetric(latest.value, "percent")} in ${latest.period.fiscalDateEnding}.`
      : `${snapshot.profile.symbol} ${direction === "stable" ? "held fairly steady" : direction} on ${selected.label} over the last ${values.length} quarters, ending at ${formatMetric(latest.value, metricFormat(selected.key))} in ${latest.period.fiscalDateEnding}.`;

  return {
    answer,
    keyPoints: [
      `Latest quarter: ${formatMetric(latest.value, metricFormat(selected.key))} on ${latest.period.fiscalDateEnding}.`,
      `Earliest quarter in view: ${formatMetric(oldest.value, metricFormat(selected.key))} on ${oldest.period.fiscalDateEnding}.`,
      `Direction over the period: ${direction}.`
    ],
    citations: values.slice(0, 4).map((entry) => citationForMetric(entry.period, selected.key)),
    confidence: snapshot.profile.source === "alpha-vantage" ? "medium" : "low"
  };
}

function pickMetric(question: string) {
  const normalized = question.toLowerCase();
  return (
    METRIC_KEYWORDS.find((metric) =>
      metric.keywords.some((keyword) => normalized.includes(keyword))
    ) ?? METRIC_KEYWORDS[0]
  );
}

function citationForMetric(
  period: CompanySnapshot["quarterly"][number],
  metric: TrendMetricKey
): SourceCitation {
  return {
    label: `${period.fiscalDateEnding} ${metric}`,
    detail: `${metricLabel(metric)} was ${formatMetric(period[metric], metricFormat(metric), { compact: false })}.`,
    source: "Parsed financial dataset",
    period: period.fiscalDateEnding,
    metric: metricLabel(metric),
    value: formatMetric(period[metric], metricFormat(metric), { compact: false })
  };
}

function metricLabel(metric: TrendMetricKey) {
  const match = METRIC_KEYWORDS.find((item) => item.key === metric);
  return match?.label ?? metric;
}

function metricFormat(metric: TrendMetricKey) {
  switch (metric) {
    case "grossMargin":
    case "roe":
      return "percent" as const;
    case "debtToEquity":
      return "multiple" as const;
    case "eps":
      return "number" as const;
    default:
      return "currency" as const;
  }
}
