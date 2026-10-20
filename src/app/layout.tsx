import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { Archivo, IBM_Plex_Mono, Mrs_Saint_Delafield } from "next/font/google";
import { NavProgress } from "@/components/nav-progress";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

// Archivo carries everything: wide for headings and form labels, normal for body.
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });
// Typed values on the slip: amounts, rules, dates.
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono", display: "swap" });
// Used only for the owner's co-signature.
const signature = Mrs_Saint_Delafield({ subsets: ["latin"], weight: "400", variable: "--font-signature-script", display: "swap" });

const TITLE = "Cosign - Your agents spend. You co-sign.";
const DESCRIPTION =
  "Let your AI assistants shop within the limits you set. Cosign approves small buys, asks you about bigger ones and blocks the rest. PayPal pays the store. Try the demo free.";

// Link previews need absolute URLs, so they are built from the public address.
export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3001"),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "Cosign",
  openGraph: { type: "website", siteName: "Cosign", title: TITLE, description: DESCRIPTION, locale: "en_US" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${plexMono.variable} ${signature.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        <div className="sandbox-strip">Sandbox - no real money moves</div>
        {children}
      </body>
    </html>
  );
}
