export type MetricFormat = "currency" | "percent" | "number" | "multiple";

export type TrendMetricKey =
  | "totalRevenue"
  | "grossMargin"
  | "operatingMargin"
  | "netIncome"
  | "eps"
  | "freeCashFlow"
  | "currentRatio"
  | "debtToEquity"
  | "roe";

export type TrendMetric = {
  key: TrendMetricKey;
  label: string;
  format: MetricFormat;
  description: string;
};

export type FinancialPeriod = {
  fiscalDateEnding: string;
  reportedDate: string | null;
  totalRevenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  eps: number | null;
  operatingCashflow: number | null;
  capitalExpenditures: number | null;
  freeCashFlow: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  shareholderEquity: number | null;
  cashAndShortTermInvestments: number | null;
  currentAssets: number | null;
  currentLiabilities: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  roe: number | null;
  revenueGrowth: number | null;
};

export type CompanyProfile = {
  symbol: string;
  name: string;
  exchange: string | null;
  sector: string | null;
  industry: string | null;
  description: string | null;
  currency: string | null;
  marketCap: number | null;
  peRatio: number | null;
  dividendYield: number | null;
  beta: number | null;
  analystTargetPrice: number | null;
  fiftyTwoWeekRange: string | null;
  nextEarningsDate: string | null;
  source: "alpha-vantage" | "demo";
};

export type DashboardMetric = {
  id: string;
  label: string;
  value: number | null;
  format: MetricFormat;
  change: number | null;
  changeLabel: string;
};

export type SourceCitation = {
  label: string;
  detail: string;
  source: string;
  period: string | null;
  metric: string | null;
  value: string | null;
};

export type AnalysisResponse = {
  answer: string;
  keyPoints: string[];
  citations: SourceCitation[];
  confidence: "high" | "medium" | "low";
};

export type QueryHistoryItem = {
  id: string;
  symbol: string;
  question: string;
  answer: string;
  createdAt: string;
  citations: SourceCitation[];
};

export type UserSession = {
  uid: string;
  isAnonymous: boolean;
  displayName: string | null;
  email: string | null;
  providerId: string | null;
};

export type WorkspaceState = {
  watchlist: string[];
  notes: Record<string, string>;
  queryHistory: QueryHistoryItem[];
  updatedAt: string;
};

export type CompanySnapshot = {
  profile: CompanyProfile;
  metrics: DashboardMetric[];
  quarterly: FinancialPeriod[];
  annual: FinancialPeriod[];
  availableMetrics: TrendMetric[];
};
