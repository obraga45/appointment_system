import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Outfit, Source_Serif_4 } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { NavigationProgress } from "@/components/navigation-progress";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TemVagas — Marcações e WhatsApp",
  description:
    "Os clientes marcam sozinhos. Confirmações e lembretes no WhatsApp. 15€/mês ou 149€ no primeiro ano.",
  metadataBase: new URL("https://temvagas.pt"),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1f4a3d",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt" className={`${outfit.variable} ${sourceSerif.variable}`}>
      <body className="min-h-dvh overflow-x-hidden font-sans antialiased">
        {children}
        <NavigationProgress />
        <Toaster />
      </body>
    </html>
  );
}
