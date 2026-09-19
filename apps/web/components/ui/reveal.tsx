"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";

/**
 * Scroll reveal. Uses IntersectionObserver and a CSS transition rather than a
 * per-frame animation library, so a long page of these costs nothing while
 * off-screen. `prefers-reduced-motion` is handled in CSS, where the `.reveal`
 * rule resolves to its shown state.
 */
export function Reveal({
  children,
  as: Tag = "div",
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  as?: ElementType;
  /** Stagger, in milliseconds. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          node.dataset.shown = "true";
          // One-shot: re-animating on every scroll past is distracting in a
          // tool people read carefully.
          observer.unobserve(node);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`reveal ${className}`}
      data-shown="false"
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}
