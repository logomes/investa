import type { Metadata, Viewport } from "next";
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
  description: "Carteira vs Benchmark — análise patrimonial",
};

// viewport-fit=cover prevents iOS Safari from subtracting the Dynamic
// Island / home-indicator safe areas from the layout viewport width.
// Without this, iPhone 15 Pro in landscape reports ~756px instead of 852px
// and falsely triggers the desktop-only gate.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
