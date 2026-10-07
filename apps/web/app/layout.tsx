import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-inter" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Elitr — agent-to-agent trading desk",
  description: "Live view of the Elitr analyst and execution agents: b402 pay-per-signal, risk checks and tokenized-stock execution on BSC.",
};

export const viewport: Viewport = {
  themeColor: "#0b0e11",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh bg-bg font-sans text-fg antialiased">{children}</body>
    </html>
  );
}
