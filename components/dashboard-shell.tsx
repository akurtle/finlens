"use client";

import {
  startTransition,
  type FormEvent,
  type ReactNode,
  useDeferredValue,
  useEffect,
  useState
} from "react";

import {
  EMPTY_WORKSPACE,
  appendQueryHistory,
  persistWorkspace,
  subscribeWorkspace,
  updateNote,
  updateWatchlist
} from "@/lib/firebase/workspace";
import {
  ensureSignedIn,
  signInWithGoogle,
  signOutUser,
  subscribeUserSession
} from "@/lib/firebase/auth";
import type {
  AnalysisResponse,
  CompanySnapshot,
  FinancialPeriod,
  QueryHistoryItem,
  TrendMetricKey,
  UserSession,
  WorkspaceState
} from "@/lib/types";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { cn, formatDateLabel, formatMetric, makeId } from "@/lib/utils";

const DEFAULT_QUESTION = "What was the gross margin trend over 8 quarters?";

export function DashboardShell() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceState>(EMPTY_WORKSPACE);
  const [snapshot, setSnapshot] = useState<CompanySnapshot | null>(null);
  const [activeSymbol, setActiveSymbol] = useState("AAPL");
  const [symbolInput, setSymbolInput] = useState("AAPL");
  const [selectedMetric, setSelectedMetric] = useState<TrendMetricKey>("grossMargin");
  const [quarterCount, setQuarterCount] = useState(8);
  const [watchlistQuery, setWatchlistQuery] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [question, setQuestion] = useState(DEFAULT_QUESTION);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [authPending, setAuthPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deferredWatchlistQuery = useDeferredValue(watchlistQuery);
  const visibleQuarters = snapshot?.quarterly.slice(0, quarterCount) ?? [];
  const inWatchlist = snapshot ? workspace.watchlist.includes(snapshot.profile.symbol) : false;
  const filteredWatchlist = workspace.watchlist.filter((item) =>
    item.includes(deferredWatchlistQuery.trim().toUpperCase())
  );

  async function syncWorkspace(nextWorkspace: WorkspaceState) {
    setWorkspace(nextWorkspace);
    await persistWorkspace(session?.uid ?? null, nextWorkspace);
  }

  useEffect(() => {
    const unsubscribe = subscribeUserSession(setSession, () => setAuthReady(true));

    void ensureSignedIn().catch((authError) => {
      console.error(authError);
      setAuthReady(true);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    return subscribeWorkspace(session?.uid ?? null, setWorkspace);
  }, [authReady, session?.uid]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/company/${activeSymbol}`);
        if (!response.ok) {
          throw new Error("Unable to load financial data.");
        }

        const nextSnapshot = (await response.json()) as CompanySnapshot;
        if (cancelled) {
          return;
        }

        setSnapshot(nextSnapshot);
        setSelectedMetric(nextSnapshot.availableMetrics[0]?.key ?? "grossMargin");
        setAnalysis(null);
      } catch (loadError) {
        console.error(loadError);
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "Unable to load financial data."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [activeSymbol]);

  useEffect(() => {
    const symbol = snapshot?.profile.symbol;
    setNoteDraft(symbol ? workspace.notes[symbol] ?? "" : "");
  }, [snapshot?.profile.symbol, workspace.notes]);

  async function handleRunAnalysis(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!snapshot || !question.trim()) {
      return;
    }

    setAnalyzing(true);
    setError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question,
          symbol: snapshot.profile.symbol,
          quarterCount
        })
      });

      if (!response.ok) {
        throw new Error("Unable to analyze company data.");
      }

      const nextAnalysis = (await response.json()) as AnalysisResponse;
      setAnalysis(nextAnalysis);

      const historyItem: QueryHistoryItem = {
        id: makeId("query"),
        symbol: snapshot.profile.symbol,
        question,
        answer: nextAnalysis.answer,
        createdAt: new Date().toISOString(),
        citations: nextAnalysis.citations
      };

      await syncWorkspace(appendQueryHistory(workspace, historyItem));
    } catch (analysisError) {
      console.error(analysisError);
      setError(
        analysisError instanceof Error ? analysisError.message : "Unable to analyze company data."
      );
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleToggleWatchlist() {
    if (!snapshot) {
      return;
    }

    await syncWorkspace(updateWatchlist(workspace, snapshot.profile.symbol));
  }

  async function handleSaveNote() {
    if (!snapshot) {
      return;
    }

    await syncWorkspace(updateNote(workspace, snapshot.profile.symbol, noteDraft));
  }

  function submitSymbol(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = symbolInput.trim().toUpperCase();

    if (!normalized) {
      return;
    }

    startTransition(() => {
      setActiveSymbol(normalized);
      setSymbolInput(normalized);
    });
  }

  function restoreHistory(item: QueryHistoryItem) {
    setQuestion(item.question);
    setAnalysis({
      answer: item.answer,
      keyPoints: [],
      citations: item.citations,
      confidence: "medium"
    });
    startTransition(() => {
      setActiveSymbol(item.symbol);
      setSymbolInput(item.symbol);
    });
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[32px] border border-white/70 bg-white/80 p-6 shadow-panel backdrop-blur xl:p-8">
        <div className="absolute inset-0 bg-mesh opacity-100" />
        <div className="relative flex flex-col gap-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs uppercase tracking-[0.28em] text-slate-500">
                <span>FinLens</span>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                <span>Research Dashboard</span>
              </div>
              <div className="space-y-3">
                <h1 className="font-[var(--font-heading)] text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
                  Search earnings data, parse fundamentals, and interrogate the trendline.
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                  FinLens ingests public company statements, normalizes quarter-level metrics,
                  persists your watchlist and notes, and lets an LLM answer questions only from
                  the parsed dataset.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <StatPill label="Source" value={snapshot?.profile.source === "alpha-vantage" ? "Live API" : "Demo mode"} />
              <StatPill label="Tracked Quarters" value={String(visibleQuarters.length || 8)} />
              <StatPill label="Workspace" value={session ? (session.isAnonymous ? "Guest" : "Cloud") : "Local"} />
            </div>
          </div>

          <form
            onSubmit={submitSymbol}
            className="grid gap-4 rounded-[28px] border border-slate-200/70 bg-slate-950 px-4 py-4 text-white shadow-panel lg:grid-cols-[1.2fr,0.8fr,0.55fr,0.55fr,0.4fr]"
          >
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-400">
                Company Search
              </span>
              <input
                value={symbolInput}
                onChange={(event) => setSymbolInput(event.target.value)}
                placeholder="AAPL, MSFT, NVDA"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-[var(--font-mono)] text-sm outline-none transition focus:border-sky-300 focus:bg-white/10"
              />
            </label>

            <div className="space-y-2">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-400">Metric</span>
              <select
                value={selectedMetric}
                onChange={(event) => setSelectedMetric(event.target.value as TrendMetricKey)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-sky-300"
              >
                {(snapshot?.availableMetrics ?? []).map((metric) => (
                  <option key={metric.key} value={metric.key} className="text-slate-900">
                    {metric.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-400">Quarters</span>
              <select
                value={quarterCount}
                onChange={(event) => setQuarterCount(Number(event.target.value))}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-sky-300"
              >
                {[4, 6, 8].map((count) => (
                  <option key={count} value={count} className="text-slate-900">
                    {count}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleToggleWatchlist}
              disabled={!snapshot}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {inWatchlist ? "Remove watch" : "Add watch"}
            </button>

            <button
              type="submit"
              className="rounded-2xl bg-skyglass px-4 py-3 text-sm font-semibold text-slate-950 transition hover:translate-y-[-1px]"
            >
              Load
            </button>
          </form>

          <div className="flex flex-col gap-3 rounded-[24px] border border-slate-200/70 bg-white/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Identity</p>
              <p className="text-sm text-slate-700">
                {isFirebaseConfigured()
                  ? session
                    ? session.isAnonymous
                      ? "Signed in as guest. Your workspace syncs to an anonymous Firebase account until you upgrade."
                      : `Signed in as ${session.email ?? session.displayName ?? "user"}.`
                    : authReady
                      ? "Firebase is configured, but no session is active."
                      : "Connecting to Firebase Auth..."
                  : "Firebase is not configured, so workspace data stays in local storage."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  setAuthPending(true);
                  setError(null);
                  try {
                    await signInWithGoogle();
                  } catch (authError) {
                    console.error(authError);
                    setError(
                      authError instanceof Error
                        ? authError.message
                        : "Unable to sign in with Google."
                    );
                  } finally {
                    setAuthPending(false);
                  }
                }}
                disabled={!isFirebaseConfigured() || authPending}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {session?.isAnonymous ? "Upgrade to Google" : "Google sign-in"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setAuthPending(true);
                  setError(null);
                  try {
                    await signOutUser();
                    await ensureSignedIn();
                  } catch (authError) {
                    console.error(authError);
                    setError(
                      authError instanceof Error ? authError.message : "Unable to sign out."
                    );
                  } finally {
                    setAuthPending(false);
                  }
                }}
                disabled={!isFirebaseConfigured() || !session || authPending}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {(snapshot?.metrics ?? []).map((metric) => (
          <MetricCard
            key={metric.id}
            label={metric.label}
            value={formatMetric(metric.value, metric.format)}
            change={
              metric.change === null
                ? "No baseline"
                : `${metric.change > 0 ? "+" : ""}${formatMetric(metric.change, "percent")}`
            }
            changeLabel={metric.changeLabel}
          />
        ))}
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.65fr,0.95fr]">
        <div className="space-y-6">
          <Panel
            title={snapshot ? `${snapshot.profile.name} (${snapshot.profile.symbol})` : "Loading company"}
            eyebrow={snapshot?.profile.industry ?? "Financial dataset"}
            actions={
              snapshot ? (
                <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                  <Tag>{snapshot.profile.exchange ?? "Exchange N/A"}</Tag>
                  <Tag>{snapshot.profile.sector ?? "Sector N/A"}</Tag>
                  <Tag>{snapshot.profile.source === "alpha-vantage" ? "Live API" : "Demo fallback"}</Tag>
                </div>
              ) : null
            }
          >
            {loading ? (
              <LoadingState />
            ) : error ? (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </p>
            ) : snapshot ? (
              <div className="space-y-6">
                <div className="grid gap-4 lg:grid-cols-[1.25fr,0.75fr]">
                  <div className="space-y-4">
                    <p className="max-w-3xl text-sm leading-6 text-slate-600">
                      {snapshot.profile.description}
                    </p>
                    <TrendChart periods={visibleQuarters} metric={selectedMetric} />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    <DetailRow
                      label="Market Cap"
                      value={formatMetric(snapshot.profile.marketCap, "currency")}
                    />
                    <DetailRow
                      label="P/E Ratio"
                      value={snapshot.profile.peRatio ? `${snapshot.profile.peRatio.toFixed(1)}x` : "N/A"}
                    />
                    <DetailRow
                      label="Analyst Target"
                      value={formatMetric(snapshot.profile.analystTargetPrice, "currency")}
                    />
                    <DetailRow
                      label="52W Range"
                      value={snapshot.profile.fiftyTwoWeekRange ?? "N/A"}
                    />
                    <DetailRow
                      label="Next Event"
                      value={snapshot.profile.nextEarningsDate ?? "N/A"}
                    />
                  </div>
                </div>

                <div className="overflow-hidden rounded-[24px] border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Quarter</th>
                        <th className="px-4 py-3">Revenue</th>
                        <th className="px-4 py-3">Gross Margin</th>
                        <th className="px-4 py-3">FCF</th>
                        <th className="px-4 py-3">ROE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {visibleQuarters.map((period) => (
                        <tr key={period.fiscalDateEnding} className="hover:bg-slate-50/80">
                          <td className="px-4 py-3 font-[var(--font-mono)] text-xs text-slate-500">
                            {period.fiscalDateEnding}
                          </td>
                          <td className="px-4 py-3">
                            {formatMetric(period.totalRevenue, "currency")}
                          </td>
                          <td className="px-4 py-3">
                            {formatMetric(period.grossMargin, "percent")}
                          </td>
                          <td className="px-4 py-3">
                            {formatMetric(period.freeCashFlow, "currency")}
                          </td>
                          <td className="px-4 py-3">{formatMetric(period.roe, "percent")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </Panel>

          <Panel title="LLM Query Interface" eyebrow="Grounded analysis from parsed company data">
            <form onSubmit={handleRunAnalysis} className="space-y-4">
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                rows={4}
                className="w-full rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm outline-none transition focus:border-accent focus:bg-white"
                placeholder={DEFAULT_QUESTION}
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Uses {visibleQuarters.length} quarterly datapoints and current metric cards.
                </p>
                <button
                  type="submit"
                  disabled={!snapshot || analyzing}
                  className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {analyzing ? "Analyzing..." : "Run analysis"}
                </button>
              </div>
            </form>

            {analysis ? (
              <div className="mt-6 space-y-4 rounded-[28px] border border-slate-200 bg-slate-50/70 p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Confidence: {analysis.confidence}
                  </span>
                  <Tag>{snapshot?.profile.symbol ?? "Ticker"}</Tag>
                </div>
                <p className="text-sm leading-7 text-slate-700">{analysis.answer}</p>
                {analysis.keyPoints.length ? (
                  <div className="space-y-2">
                    {analysis.keyPoints.map((point) => (
                      <div
                        key={point}
                        className="rounded-2xl border border-white bg-white px-4 py-3 text-sm text-slate-600"
                      >
                        {point}
                      </div>
                    ))}
                  </div>
                ) : null}
                {analysis.citations.length ? (
                  <div className="space-y-2">
                    <h3 className="text-xs uppercase tracking-[0.18em] text-slate-500">Citations</h3>
                    {analysis.citations.map((citation) => (
                      <div
                        key={`${citation.label}-${citation.period}`}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                      >
                        <p className="text-sm font-medium text-slate-900">{citation.label}</p>
                        <p className="mt-1 text-sm text-slate-600">{citation.detail}</p>
                        <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                          {citation.source}
                          {citation.period ? ` | ${citation.period}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Watchlist" eyebrow="Firestore-backed workspace">
            <div className="space-y-4">
              <input
                value={watchlistQuery}
                onChange={(event) => setWatchlistQuery(event.target.value)}
                placeholder="Filter watchlist"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-accent focus:bg-white"
              />
              <div className="grid gap-2">
                {filteredWatchlist.length ? (
                  filteredWatchlist.map((symbol) => (
                    <button
                      key={symbol}
                      type="button"
                      onClick={() => {
                        startTransition(() => {
                          setActiveSymbol(symbol);
                          setSymbolInput(symbol);
                        });
                      }}
                      className={cn(
                        "flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition",
                        symbol === activeSymbol
                          ? "border-ink bg-ink text-white"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      )}
                    >
                      <span className="font-[var(--font-mono)] text-sm">{symbol}</span>
                      <span className="text-xs uppercase tracking-[0.16em] opacity-70">
                        Open
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                    No watchlist matches your filter.
                  </p>
                )}
              </div>
            </div>
          </Panel>

          <Panel title="Notes" eyebrow="Per-symbol research context">
            <div className="space-y-4">
              <textarea
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                rows={7}
                className="w-full rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm outline-none transition focus:border-accent focus:bg-white"
                placeholder="Save channel checks, thesis updates, or model assumptions here."
              />
              <button
                type="button"
                onClick={handleSaveNote}
                disabled={!snapshot}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300"
              >
                Save note
              </button>
            </div>
          </Panel>

          <Panel title="Query History" eyebrow="Recent grounded responses">
            <div className="space-y-3">
              {workspace.queryHistory.length ? (
                workspace.queryHistory.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => restoreHistory(item)}
                    className="w-full rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-slate-300"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-[var(--font-mono)] text-xs uppercase tracking-[0.16em] text-slate-500">
                        {item.symbol}
                      </span>
                      <span className="text-xs text-slate-400">
                        {formatDateLabel(item.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-900">{item.question}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {item.answer}
                    </p>
                  </button>
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                  Ask the first question to seed your history.
                </p>
              )}
            </div>
          </Panel>
        </div>
      </section>
    </main>
  );
}

function Panel({
  title,
  eyebrow,
  actions,
  children
}: {
  title: string;
  eyebrow: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[32px] border border-white/70 bg-white/85 p-5 shadow-panel backdrop-blur sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{eyebrow}</p>
          <h2 className="font-[var(--font-heading)] text-2xl font-semibold tracking-tight text-ink">
            {title}
          </h2>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  change,
  changeLabel,
  className
}: {
  label: string;
  value: string;
  change: string;
  changeLabel: string;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "animate-reveal rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-panel backdrop-blur",
        className
      )}
    >
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <div className="mt-4 flex items-end justify-between gap-4">
        <p className="font-[var(--font-heading)] text-3xl font-semibold text-ink">{value}</p>
        <div className="text-right">
          <p className="text-sm font-medium text-slate-700">{change}</p>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{changeLabel}</p>
        </div>
      </div>
    </article>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white/80 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 font-[var(--font-heading)] text-xl font-semibold text-ink">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-slate-500">
      {children}
    </span>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.25fr,0.75fr]">
      <div className="space-y-3">
        <div className="h-5 w-2/3 animate-pulse rounded-full bg-slate-200" />
        <div className="h-5 w-5/6 animate-pulse rounded-full bg-slate-200" />
        <div className="h-64 animate-pulse rounded-[28px] bg-slate-100" />
      </div>
      <div className="grid gap-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

function TrendChart({
  periods,
  metric
}: {
  periods: FinancialPeriod[];
  metric: TrendMetricKey;
}) {
  const points = periods
    .map((period, index) => ({
      index,
      label: formatDateLabel(period.fiscalDateEnding),
      value: period[metric]
    }))
    .filter((point): point is { index: number; label: string; value: number } => point.value !== null);

  if (points.length < 2) {
    return (
      <div className="flex h-72 items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
        Not enough datapoints for this chart.
      </div>
    );
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const chartPoints = points.map((point, index) => {
    const x = 10 + (index * 80) / (points.length - 1);
    const y = 58 - ((point.value - min) / range) * 42;
    return { ...point, x, y };
  });

  const path = chartPoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const area = `${path} L 90 58 L 10 58 Z`;

  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,rgba(217,244,255,0.45),rgba(255,255,255,0.95))] p-5">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Trend view</p>
          <h3 className="mt-1 font-[var(--font-heading)] text-xl font-semibold text-ink">
            {metricLabel(metric)}
          </h3>
        </div>
        <p className="text-xs text-slate-500">
          Latest: {formatMetric(points[0]?.value ?? null, metricFormat(metric))}
        </p>
      </div>

      <svg viewBox="0 0 100 60" className="h-64 w-full">
        <defs>
          <linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(15,118,110,0.28)" />
            <stop offset="100%" stopColor="rgba(15,118,110,0)" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#trendArea)" />
        <path d={path} fill="none" stroke="#0f766e" strokeWidth="2.2" strokeLinecap="round" />
        {chartPoints.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="1.8" fill="#09111f" />
            <text
              x={point.x}
              y={58.5}
              textAnchor="middle"
              fontSize="2.6"
              fill="#475569"
            >
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function metricLabel(metric: TrendMetricKey) {
  switch (metric) {
    case "totalRevenue":
      return "Revenue";
    case "grossMargin":
      return "Gross Margin";
    case "operatingMargin":
      return "Operating Margin";
    case "netIncome":
      return "Net Income";
    case "eps":
      return "EPS";
    case "freeCashFlow":
      return "Free Cash Flow";
    case "currentRatio":
      return "Current Ratio";
    case "debtToEquity":
      return "Debt / Equity";
    case "roe":
      return "ROE";
  }
}

function metricFormat(metric: TrendMetricKey) {
  switch (metric) {
    case "grossMargin":
    case "operatingMargin":
    case "roe":
      return "percent" as const;
    case "debtToEquity":
    case "currentRatio":
      return "multiple" as const;
    case "eps":
      return "number" as const;
    default:
      return "currency" as const;
  }
}
