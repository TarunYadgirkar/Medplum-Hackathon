import type { Metadata } from "next";
import { Archivo, Jost, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";

// Design language (docs/UI_SPEC.md + Claude Design handoff):
// Archivo = headings (800) + body/labels (400/600), Jost 300 = numerals,
// Spline Sans Mono = code/transcript, Material Symbols Sharp = icons (globals.css).
const archivo = Archivo({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"], variable: "--font-archivo" });
const jost = Jost({ subsets: ["latin"], weight: ["300", "400"], variable: "--font-jost" });
const splineMono = Spline_Sans_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-spline-mono" });

export const metadata: Metadata = {
  title: "Prelude",
  description: "Voice-first pre-visit intake: your conversation is charted to FHIR as it happens, with live insurance cost answers.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full antialiased ${archivo.variable} ${jost.variable} ${splineMono.variable}`}>
      <body className="min-h-full bg-surface text-ink flex flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
