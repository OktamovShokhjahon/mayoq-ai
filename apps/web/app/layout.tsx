import type { Metadata } from "next";
// Fonts are self-hosted rather than pulled through next/font/google. Next 14
// gives that loader a 3s budget in dev, which this app's first compile loses
// while the 3D scene is building — the fetch aborts, retries and never lets
// the page render. Shipping the files also means the demo runs offline.
import "@fontsource-variable/archivo";
import "@fontsource-variable/public-sans";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./globals.css";
import { QueryProvider } from "@/lib/query-provider";
import { SafetyBanner } from "@/components/ui/safety-banner";
import { ToastProvider } from "@/components/ui/toast";
import { ThemeProvider, themeBootScript } from "@/lib/theme";
import { I18nProvider, localeBootScript } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "MAYOQ AI · Klinik qaror qo'llab-quvvatlash",
  description: "AI-assisted chronic-care and medication-safety decision support.",
  icons: {
    icon: [{ url: "/logo.svg", type: "image/svg+xml" }],
    apple: "/logo.webp",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Uzbek is the default, so that is what the server renders.
    <html lang="uz-Latn" suppressHydrationWarning>
      <head>
        {/* Applies the stored theme and language before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <script dangerouslySetInnerHTML={{ __html: localeBootScript }} />
      </head>
      <body>
        <I18nProvider>
          <ThemeProvider>
            <QueryProvider>
              <ToastProvider>
                <div className="flex min-h-screen flex-col">
                  <div className="flex-1">{children}</div>
                  <SafetyBanner />
                </div>
              </ToastProvider>
            </QueryProvider>
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
