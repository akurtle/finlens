import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { fetchCompanySnapshot } from "@/lib/finance/alpha-vantage";
import type { CompanySnapshot, CompanySnapshotRecord, SnapshotCacheMeta } from "@/lib/types";

type PersistedRecord = {
  fetchedAt: string;
  snapshot: CompanySnapshot;
};

const CACHE_TTL_MINUTES = Number(process.env.FINLENS_CACHE_TTL_MINUTES ?? 360);
const CACHE_ROOT = path.join(process.cwd(), ".finlens-cache", "snapshots");

export async function getCompanySnapshotRecord(
  symbol: string,
  options?: { refresh?: boolean }
): Promise<CompanySnapshotRecord> {
  const normalized = symbol.trim().toUpperCase();
  const cached = await readCachedRecord(normalized);
  const now = new Date();

  if (!options?.refresh && cached && !isExpired(cached.fetchedAt, now)) {
    return {
      snapshot: cached.snapshot,
      cache: createCacheMeta(cached.fetchedAt, now, cached.snapshot.profile.source, "disk-cache")
    };
  }

  try {
    const snapshot = await fetchCompanySnapshot(normalized);
    const fetchedAt = now.toISOString();
    await persistRecord(normalized, { fetchedAt, snapshot });
    return {
      snapshot,
      cache: createCacheMeta(
        fetchedAt,
        now,
        snapshot.profile.source,
        snapshot.profile.source === "demo" ? "demo" : "network"
      )
    };
  } catch (error) {
    console.error("Failed to refresh snapshot record.", error);

    if (cached) {
      return {
        snapshot: cached.snapshot,
        cache: createCacheMeta(cached.fetchedAt, now, cached.snapshot.profile.source, "stale-cache")
      };
    }

    throw error;
  }
}

async function readCachedRecord(symbol: string) {
  try {
    const file = await readFile(cachePath(symbol), "utf8");
    return JSON.parse(file) as PersistedRecord;
  } catch {
    return null;
  }
}

async function persistRecord(symbol: string, record: PersistedRecord) {
  await mkdir(CACHE_ROOT, { recursive: true });
  await writeFile(cachePath(symbol), JSON.stringify(record, null, 2), "utf8");
}

function cachePath(symbol: string) {
  return path.join(CACHE_ROOT, `${symbol}.json`);
}

function isExpired(fetchedAt: string, now: Date) {
  const fetched = new Date(fetchedAt);
  return now.getTime() - fetched.getTime() > CACHE_TTL_MINUTES * 60 * 1000;
}

function createCacheMeta(
  fetchedAt: string,
  now: Date,
  source: CompanySnapshot["profile"]["source"],
  transport: SnapshotCacheMeta["transport"]
): SnapshotCacheMeta {
  const fetched = new Date(fetchedAt);
  const expiresAt = new Date(fetched.getTime() + CACHE_TTL_MINUTES * 60 * 1000).toISOString();
  const ageMinutes = Math.max(0, Math.round((now.getTime() - fetched.getTime()) / 60000));
  const isStale = transport === "stale-cache" || isExpired(fetchedAt, now);

  return {
    fetchedAt,
    expiresAt,
    ageMinutes,
    isStale,
    status: source === "demo" ? "demo" : isStale ? "stale" : "fresh",
    transport
  };
}
