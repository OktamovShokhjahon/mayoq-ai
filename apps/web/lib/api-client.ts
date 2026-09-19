"use client";

import { useAuthStore } from "./auth-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

/**
 * Access tokens last fifteen minutes. Without this, a doctor who spends longer
 * than that on one chart gets an unexplained failure on their next action — so
 * a 401 is retried once behind a refresh, and only a failed refresh ends the
 * session. Concurrent 401s share one refresh rather than racing each other.
 */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const { refreshToken, setSession, clearSession } = useAuthStore.getState();
  if (!refreshToken) return false;

  refreshInFlight ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        // Only a token the server actually rejected ends the session. A 429
        // from the rate limiter, a 500, or a dropped connection says nothing
        // about whether the refresh token is still valid — clearing on those
        // signed people out mid-session and looked like a broken login.
        if (res.status === 401 || res.status === 403) clearSession();
        return false;
      }
      const body = await res.json();
      // The refresh endpoint returns tokens only; the signed-in user is
      // unchanged, so keep the one already in the store rather than clearing it.
      const currentUser = useAuthStore.getState().user;
      if (!currentUser) return false;
      setSession({ accessToken: body.accessToken, refreshToken: body.refreshToken, user: currentUser });
      return true;
    } catch {
      return false;
    } finally {
      // Cleared on the next tick so callers awaiting this promise all see it.
      setTimeout(() => {
        refreshInFlight = null;
      }, 0);
    }
  })();

  return refreshInFlight;
}

async function send(path: string, options: RequestInit, retry: boolean): Promise<Response> {
  const { accessToken } = useAuthStore.getState();
  const headers = new Headers(options.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (res.status === 401 && retry && (await refreshSession())) {
    return send(path, options, false);
  }
  return res;
}

async function unwrap<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => undefined);
  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? "Request failed", body?.details);
  }
  return body as T;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  return unwrap<T>(await send(path, { ...options, headers }, true));
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PATCH", body: data ? JSON.stringify(data) : undefined }),
  /** Fetches a file with the session's token and hands it to the browser as a download. */
  download: async (path: string, fallbackName: string): Promise<void> => {
    const res = await send(path, { method: "GET" }, true);
    if (!res.ok) {
      const body = await res.json().catch(() => undefined);
      throw new ApiError(res.status, body?.error ?? "Download failed", body?.details);
    }
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const name = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? fallbackName;
    const url = URL.createObjectURL(await res.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  },
  /**
   * Multipart upload. The browser must set its own boundary, so this one never
   * sets Content-Type.
   */
  upload: async <T>(path: string, file: File): Promise<T> => {
    const form = new FormData();
    form.append("file", file);
    return unwrap<T>(await send(path, { method: "POST", body: form }, true));
  },
};
