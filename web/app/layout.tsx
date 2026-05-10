import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Shell } from "@/components/shell/Shell";
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
        {/* Mobile-only fallback (<768px). Tablet+ uses the responsive Shell. */}
        <div className="desktop-only-warning min-h-screen flex items-center justify-center px-6 text-center">
          <div className="max-w-sm">
            <h1 className="text-xl font-bold text-ink mb-2">Use tablet ou desktop</h1>
            <p className="text-sm text-ink-2">
              O dashboard é desenhado para telas ≥768px. Mobile-first vem em uma fase futura.
            </p>
          </div>
        </div>

        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
