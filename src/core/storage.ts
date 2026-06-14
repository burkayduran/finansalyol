// Local-first persistence + export/import (§11 kapsamında VAR).
// Auth yok, sync yok. Tek kaynak: localStorage.

import type { AppState } from "./types";

const STORAGE_KEY = "borc-takip-0a:state:v1";

export const emptyState: AppState = {
  debts: [],
  profile: {},
  strategy: "avalanche",
  mode: "real",
  reminders: [],
  payments: [],
};

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(emptyState);
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return { ...structuredClone(emptyState), ...parsed };
  } catch {
    return structuredClone(emptyState);
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota / private mode — sessizce devam et (local-first best effort).
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

/** JSON dışa aktarım — kullanıcı verisini taşıyabilsin. */
export function exportState(state: AppState): string {
  return JSON.stringify({ app: "borc-takip-0a", version: "0.2.0", state }, null, 2);
}

/** JSON içe aktarım — yapısal doğrulama ile. */
export function importState(raw: string): AppState | null {
  try {
    const parsed = JSON.parse(raw);
    const candidate = (parsed?.state ?? parsed) as Partial<AppState>;
    if (!candidate || !Array.isArray(candidate.debts)) return null;
    return { ...structuredClone(emptyState), ...candidate };
  } catch {
    return null;
  }
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
