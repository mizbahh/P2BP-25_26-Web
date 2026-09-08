import { API_BASE_URL } from "../lib/env";
import * as authStore from "./authStore";

const RETRY_HEADER = "x-auth-retry";

export class ApiError extends Error {
  status: number;
  body?: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** internal - marks a request as an already-retried-once request */
  _retry?: boolean;
}

function buildRequest(options: RequestOptions): RequestInit {
  const headers = new Headers(options.headers);
  if (options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const token = authStore.getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options._retry) headers.set(RETRY_HEADER, "1");

  return {
    ...options,
    headers,
    credentials: "include",
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  };
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Thin fetch wrapper replicating the Angular AuthInterceptor: attaches the bearer
 * token + credentials to every call, and on a 401 (from anything except the
 * refresh endpoint itself, and not already a retry) attempts one silent refresh
 * before retrying the original request once.
 */
export async function apiFetch<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const isRefreshCall = path.startsWith("/api/auth/refresh");
  const res = await fetch(`${API_BASE_URL}${path}`, buildRequest(options));

  if (res.status === 401 && !isRefreshCall && !options._retry) {
    try {
      const refreshed = await authStore.refreshOnce();
      if (refreshed.Success) {
        return apiFetch<T>(path, { ...options, _retry: true });
      }
    } catch {
      // fall through to logout below
    }
    await authStore.logout();
    throw new ApiError(401, "Session expired.");
  }

  const body = await parseBody(res);
  if (!res.ok) {
    const message =
      (typeof body === "object" && body !== null && "Message" in body && String((body as { Message?: unknown }).Message)) ||
      (typeof body === "string" && body) ||
      `Request failed (${res.status})`;
    throw new ApiError(res.status, message, body);
  }

  return body as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => apiFetch<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "POST", body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: RequestOptions) => apiFetch<T>(path, { ...options, method: "DELETE" }),
};
