"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Role = "ADMIN" | "DOCTOR" | "PATIENT";

export interface AuthUser {
  id: string;
  role: Role;
  fullName: string;
  email: string;
  tenantId: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  setSession: (params: { accessToken: string; refreshToken: string; user: AuthUser }) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setSession: ({ accessToken, refreshToken, user }) => set({ accessToken, refreshToken, user }),
      clearSession: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: "twinrx-auth" }
  )
);

/**
 * The persisted session is restored from storage asynchronously, so the first
 * render always sees a null user. Route guards must wait for this to avoid
 * bouncing an authenticated user to /login on refresh or direct navigation.
 */
export function useAuthHydrated(): boolean {
  // Must start false so the server render and the client's first render agree;
  // flipping it in an effect keeps hydration consistent.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const unsubFinish = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    if (useAuthStore.persist.hasHydrated()) setHydrated(true);
    return unsubFinish;
  }, []);

  return hydrated;
}
