import { API_BASE_URL } from "../lib/env";
import type { AuthResponse, StoredAuth } from "../lib/types";

/**
 * Framework-agnostic auth state, mirroring the Angular AuthService: the JWT +
 * user object live together in localStorage; the refresh token itself lives only
 * in an HttpOnly cookie this code never touches directly (credentials: 'include'
 * is what makes the browser attach it). Kept outside React so apiClient.ts can
 * read/refresh the token without importing React or creating a circular
 * dependency with a context provider.
 */

const STORAGE_KEY = "bp_auth";
const REFRESH_SKEW_MS = 60_000;

let current: StoredAuth | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let refreshInFlight: Promise<AuthResponse> | null = null;
const listeners = new Set<(state: StoredAuth | null) => void>();

function loadFromStorage(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredAuth) : null;
  } catch {
    return null;
  }
}

function persist(state: StoredAuth | null): void {
  try {
    if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable (private browsing, blocked storage) - in-memory state still works for this tab.
  }
}

function notify(): void {
  for (const listener of listeners) listener(current);
}

function isExpired(state: StoredAuth): boolean {
  return new Date(state.ExpiresAtUtc).getTime() <= Date.now();
}

function clearRefreshTimer(): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

function scheduleRefresh(state: StoredAuth): void {
  clearRefreshTimer();
  const delay = Math.max(new Date(state.ExpiresAtUtc).getTime() - Date.now() - REFRESH_SKEW_MS, 0);
  refreshTimer = setTimeout(() => {
    refreshOnce().catch(() => clearState());
  }, delay);
}

function applyAuthResponse(resp: AuthResponse): void {
  if (!resp.Success || !resp.Token || !resp.ExpiresAtUtc || !resp.User) {
    throw new Error(resp.Message ?? "Authentication failed");
  }
  current = { Token: resp.Token, ExpiresAtUtc: resp.ExpiresAtUtc, User: resp.User };
  persist(current);
  scheduleRefresh(current);
  notify();
}

async function rawPost(path: string, body: unknown): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as AuthResponse;
  if (!res.ok) {
    return { Success: false, Message: data.Message ?? `Request failed (${res.status})` };
  }
  return data;
}

export function getState(): StoredAuth | null {
  return current;
}

export function getToken(): string | null {
  return current?.Token ?? null;
}

export function isAuthenticated(): boolean {
  return !!current && !isExpired(current);
}

export function subscribe(listener: (state: StoredAuth | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearState(): void {
  current = null;
  clearRefreshTimer();
  persist(null);
  notify();
}

/**
 * Dev-only escape hatch: fakes a logged-in session without hitting the API, so
 * the post-login UI can be previewed before a real backend/Firestore is wired up.
 * Only ever called from a button gated on import.meta.env.DEV - never shipped.
 */
export function _devPreviewLogin(): void {
  current = {
    Token: "preview-token",
    ExpiresAtUtc: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    User: { Id: "preview-user", FirstName: "Preview", LastName: "User", Email: "preview@example.com" },
  };
  persist(current);
  notify();
}

export function setProfileNames(firstName: string, lastName: string): void {
  if (!current) return;
  current = { ...current, User: { ...current.User, FirstName: firstName, LastName: lastName } };
  persist(current);
  notify();
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const resp = await rawPost("/api/login/authenticate", { email, password });
  if (resp.Success) applyAuthResponse(resp);
  return resp;
}

export async function register(
  firstName: string,
  lastName: string,
  email: string,
  password: string,
): Promise<{ Success: boolean; Message?: string }> {
  const res = await fetch(`${API_BASE_URL}/api/register`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ FirstName: firstName, LastName: lastName, Email: email, Password: password }),
  });
  return res.json();
}

/** Dedupes concurrent refresh calls, matching the Angular AuthService.refreshOnce. */
export function refreshOnce(): Promise<AuthResponse> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = rawPost("/api/auth/refresh", {})
    .then((resp) => {
      if (resp.Success) applyAuthResponse(resp);
      return resp;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

export async function logout(): Promise<void> {
  clearState(); // optimistic, matching the Angular client
  try {
    await fetch(`${API_BASE_URL}/api/auth/logout`, { method: "POST", credentials: "include" });
  } catch {
    // best-effort; local state is already cleared
  }
}

/** Call once at app startup: hydrate from localStorage, or silently try the refresh cookie. */
export async function init(): Promise<void> {
  const stored = loadFromStorage();
  if (stored && !isExpired(stored)) {
    current = stored;
    scheduleRefresh(stored);
    notify();
    return;
  }

  try {
    await refreshOnce();
  } catch {
    clearState();
  }
}
