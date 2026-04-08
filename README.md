# FinLens

FinLens is a Next.js financial research dashboard that aggregates quarterly fundamentals from public company APIs, normalizes the data into a searchable dashboard, and exposes a grounded LLM query surface over the parsed dataset.

## Stack

- Next.js App Router with TypeScript
- Tailwind CSS for the UI
- Alpha Vantage for public-market fundamentals and earnings data
- Server-side snapshot caching with stale-cache fallback
- Firebase Firestore for watchlists, notes, and query history
- Firebase Auth for user-scoped workspace ownership
- OpenAI Responses API for grounded natural-language analysis

## Features

- Searchable company loader for public tickers such as `AAPL`, `MSFT`, and `NVDA`
- Parsed quarterly dataset with revenue, margins, free cash flow, leverage, and ROE
- Filterable trend chart across 4, 6, or 8 quarters
- Firestore-backed workspace for watchlists, per-symbol notes, and query history
- Anonymous or Google-backed Firebase Auth session for per-user data ownership
- LLM analysis endpoint that cites the supplied financial periods and falls back to deterministic summaries when no OpenAI key is configured
- Demo financial dataset so the app still runs when no market-data key is present
- Disk-backed snapshot cache with freshness metadata and manual refresh controls

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in the keys you want to enable.

3. Start the app:

   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000`.

## Verification

- `npm test`
  - Runs the repository's single-process financial regression checks.
- `npm run build`
  - Validates the production Next.js build.

## Environment Notes

- `ALPHA_VANTAGE_API_KEY`
  - Enables live company statements and earnings.
  - Without it, FinLens serves deterministic demo data.
- `FINLENS_CACHE_TTL_MINUTES`
  - Controls how long server-side snapshot cache files remain fresh before a refresh is attempted.
  - Defaults to `360`.
- `OPENAI_API_KEY`
  - Enables the LLM query interface.
  - Without it, FinLens returns a grounded rule-based summary from the same parsed dataset.
- `NEXT_PUBLIC_FIREBASE_*`
  - Enables Firebase Auth plus Firestore persistence and real-time sync.
  - Without these values, the app falls back to local storage so the interface remains usable.
- `firestore.rules`
  - Restricts workspace reads and writes to the authenticated user document path.

## Project Structure

- `app/`
  - UI entrypoints and route handlers
- `components/dashboard-shell.tsx`
  - Main dashboard experience and client-side workflow
- `lib/finance/`
  - Data fetching, parsing, demo data, and fallback analysis
- `lib/firebase/`
  - Firestore initialization and workspace persistence helpers
- `scripts/run-tests.mts`
  - Lightweight regression checks for parser and analysis logic

## CI And Deployment

- GitHub Actions workflow: `.github/workflows/ci.yml`
  - Runs `npm ci`, `npm test`, and `npm run build` on pushes and pull requests.
- Recommended deployment target: Vercel
  - Add the same environment variables from `.env.example` in the Vercel project settings.
  - For live market data and grounded analysis in production, configure `ALPHA_VANTAGE_API_KEY` and `OPENAI_API_KEY`.
  - For authenticated cloud persistence, configure the `NEXT_PUBLIC_FIREBASE_*` variables and deploy `firestore.rules`.

## Grounded Analysis Design

The analysis route only sends the normalized company snapshot into the model prompt. The response is constrained to a structured schema containing:

- `answer`
- `keyPoints`
- `citations`
- `confidence`

If the OpenAI request fails or no key is configured, FinLens returns a deterministic analysis based on the exact same quarter-level values, so the UI stays functional during development.
