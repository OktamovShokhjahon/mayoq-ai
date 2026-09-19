"use client";

import { useEffect, useState } from "react";

/**
 * Tracks `prefers-reduced-motion`. The 3D scene uses this to stop auto-rotation
 * and organ pulsing — clinical state must stay readable without animation.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
