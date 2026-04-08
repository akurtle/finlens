"use client";

import {
  doc,
  onSnapshot,
  setDoc
} from "firebase/firestore";

import { getFirestoreDb } from "@/lib/firebase/client";
import type { QueryHistoryItem, SavedResearchView, WorkspaceState } from "@/lib/types";
import { asUtcIso, makeId } from "@/lib/utils";

const STORAGE_KEY = "finlens-workspace";

export const EMPTY_WORKSPACE: WorkspaceState = {
  watchlist: ["AAPL", "MSFT", "NVDA"],
  notes: {},
  queryHistory: [],
  savedViews: [],
  updatedAt: asUtcIso()
};

export function subscribeWorkspace(
  userId: string | null,
  onChange: (workspace: WorkspaceState) => void
) {
  const db = getFirestoreDb();

  if (!db || !userId) {
    const loadLocal = () => onChange(readLocalWorkspace());
    loadLocal();
    window.addEventListener("storage", loadLocal);
    return () => window.removeEventListener("storage", loadLocal);
  }

  const workspaceRef = doc(db, "users", userId, "workspace", "finlens");

  return onSnapshot(workspaceRef, (snapshot) => {
    if (!snapshot.exists()) {
      void persistWorkspace(userId, EMPTY_WORKSPACE, db);
      onChange(EMPTY_WORKSPACE);
      return;
    }

    onChange(normalizeWorkspace(snapshot.data() as Partial<WorkspaceState>));
  });
}

export async function persistWorkspace(
  userId: string | null,
  workspace: WorkspaceState,
  db = getFirestoreDb()
) {
  const normalized = normalizeWorkspace(workspace);

  if (!db || !userId) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return;
  }

  await setDoc(doc(db, "users", userId, "workspace", "finlens"), normalized, {
    merge: true
  });
}

export function updateWatchlist(workspace: WorkspaceState, symbol: string) {
  const normalized = symbol.toUpperCase();
  const exists = workspace.watchlist.includes(normalized);

  return normalizeWorkspace({
    ...workspace,
    updatedAt: asUtcIso(),
    watchlist: exists
      ? workspace.watchlist.filter((item) => item !== normalized)
      : [normalized, ...workspace.watchlist]
  });
}

export function updateNote(workspace: WorkspaceState, symbol: string, note: string) {
  return normalizeWorkspace({
    ...workspace,
    updatedAt: asUtcIso(),
    notes: {
      ...workspace.notes,
      [symbol.toUpperCase()]: note
    }
  });
}

export function appendQueryHistory(workspace: WorkspaceState, item: QueryHistoryItem) {
  return normalizeWorkspace({
    ...workspace,
    updatedAt: asUtcIso(),
    queryHistory: [item, ...workspace.queryHistory].slice(0, 12)
  });
}

export function createSavedView(input: Omit<SavedResearchView, "id" | "createdAt">): SavedResearchView {
  return {
    ...input,
    id: makeId("view"),
    createdAt: asUtcIso()
  };
}

export function upsertSavedView(workspace: WorkspaceState, view: SavedResearchView) {
  return normalizeWorkspace({
    ...workspace,
    updatedAt: asUtcIso(),
    savedViews: [view, ...workspace.savedViews.filter((item) => item.id !== view.id)].slice(0, 10)
  });
}

export function removeSavedView(workspace: WorkspaceState, viewId: string) {
  return normalizeWorkspace({
    ...workspace,
    updatedAt: asUtcIso(),
    savedViews: workspace.savedViews.filter((item) => item.id !== viewId)
  });
}

function readLocalWorkspace() {
  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return EMPTY_WORKSPACE;
  }

  try {
    return normalizeWorkspace(JSON.parse(raw) as Partial<WorkspaceState>);
  } catch {
    return EMPTY_WORKSPACE;
  }
}

function normalizeWorkspace(workspace: Partial<WorkspaceState>): WorkspaceState {
  return {
    watchlist: Array.from(new Set((workspace.watchlist ?? EMPTY_WORKSPACE.watchlist).map((item) => item.toUpperCase()))),
    notes: workspace.notes ?? {},
    queryHistory: (workspace.queryHistory ?? []).map((item) => ({
      ...item,
      citations: (item.citations ?? []).map((citation) => ({
        ...citation,
        formula: citation.formula ?? null,
        inputs: citation.inputs ?? []
      }))
    })),
    savedViews: (workspace.savedViews ?? []).map((view) => ({
      ...view,
      compareSymbols: (view.compareSymbols ?? []).map((symbol) => symbol.toUpperCase())
    })),
    updatedAt: workspace.updatedAt ?? asUtcIso()
  };
}
