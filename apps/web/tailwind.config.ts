import type { Config } from "tailwindcss";

/** Resolves a channel variable, letting Tailwind supply the alpha it needs. */
const withAlpha = (variable: string) => `rgb(var(${variable}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  // Theming runs entirely through the channel variables above, driven by
  // `data-theme` on <html>. No `dark:` variants are needed or used.
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      // Every colour resolves through a CSS variable holding bare RGB
      // channels, so the whole palette follows the active theme and Tailwind's
      // opacity modifiers (`bg-ink/[0.035]`) still compose correctly.
      colors: {
        paper: withAlpha("--rgb-paper"),
        "paper-deep": withAlpha("--rgb-paper-deep"),
        surface: withAlpha("--rgb-surface"),
        sunken: withAlpha("--rgb-sunken"),
        lamp: withAlpha("--rgb-lamp"),
        sea: withAlpha("--rgb-sea"),
        console: withAlpha("--rgb-console"),
        signal: withAlpha("--rgb-signal"),
        navy: { DEFAULT: withAlpha("--rgb-navy"), deep: withAlpha("--rgb-navy-deep") },
        cyan: withAlpha("--rgb-cyan"),
        electric: withAlpha("--rgb-electric"),
        ai: withAlpha("--rgb-ai"),
        state: {
          green: withAlpha("--rgb-state-green"),
          amber: withAlpha("--rgb-state-amber"),
          red: withAlpha("--rgb-state-red"),
        },
        ink: {
          DEFAULT: withAlpha("--rgb-ink"),
          muted: withAlpha("--rgb-ink-muted"),
          faint: withAlpha("--rgb-ink-faint"),
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "sans-serif"],
        body: ["var(--font-body)", "ui-sans-serif", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        lg: "0.625rem",
        xl2: "1.25rem",
      },
      maxWidth: {
        readable: "62ch",
      },
    },
  },
  plugins: [],
};

export default config;
