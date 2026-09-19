"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "mayoq-theme";

/**
 * Runs before first paint, inlined in <head>. Without it the document renders
 * in the default theme for a frame and then corrects itself — on a console
 * that is mostly dark chrome, that flash is a white sheet in a dark room.
 */
export const themeBootScript = `(function(){try{var p=localStorage.getItem("${STORAGE_KEY}");if(p==="light"||p==="dark"){document.documentElement.setAttribute("data-theme",p)}}catch(e){}})();`;

interface ThemeContextValue {
  /** What the viewer chose, which may be "system". */
  preference: ThemePreference;
  /** What is actually on screen right now. */
  resolved: "light" | "dark";
  setPreference: (next: ThemePreference) => void;
  /** Flips between light and dark, leaving "system" behind. */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);


export function ThemeProvider({ children }: { children: ReactNode }) {
  // Both renders must agree, so the first client render assumes the same
  // default the server produced and the effect below corrects it.
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [systemIsDark, setSystemIsDark] = useState(false);

  // Derived, never stored. Holding `resolved` in its own state let the effect
  // that reads storage and the effect that watches the media query race, and
  // the loser decided the label — so the switch could read "Night" over a page
  // that was plainly light.
  const resolved: "light" | "dark" =
    preference === "system" ? (systemIsDark ? "dark" : "light") : preference;

  useEffect(() => {
    let stored: ThemePreference = "system";
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === "light" || raw === "dark") stored = raw;
    } catch {
      // Private mode or blocked storage: fall back to following the system.
    }
    setPreferenceState(stored);
  }, []);

  // Track the system setting even while it is overridden, so releasing the
  // override back to "system" lands on the right theme immediately.
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemIsDark(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (preference === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", preference);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The choice still applies to this tab; it just will not be remembered.
    }
  }, []);

  const toggle = useCallback(() => {
    setPreference(resolved === "dark" ? "light" : "dark");
  }, [resolved, setPreference]);

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}
