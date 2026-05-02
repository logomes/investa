import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { ScenarioDrawer } from "@/components/scenario-drawer/ScenarioDrawer";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "investa — Análise patrimonial",
  description: "Imóvel vs Carteira diversificada — análise patrimonial",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased">
        {/* Desktop-only message */}
        <div className="desktop-only-warning min-h-screen flex items-center justify-center px-6 text-center">
          <div className="max-w-sm">
            <h1 className="text-xl font-bold text-ink mb-2">Use desktop ≥1280px</h1>
            <p className="text-sm text-ink-2">
              O dashboard é desenhado para telas ≥1280px. Mobile vem em uma fase futura.
            </p>
          </div>
        </div>

        <Providers>
          <div className="shell-grid relative z-[1] flex min-h-screen">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0">
              <Topbar />
              <div className="flex-1 px-8 py-6">{children}</div>
            </main>
          </div>
          <ScenarioDrawer />
        </Providers>
      </body>
    </html>
  );
}
