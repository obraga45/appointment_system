import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Outfit, Source_Serif_4 } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
});

export const metadata: Metadata = {
  title: "MarcaJá — Marcações e lembretes WhatsApp",
  description:
    "Sistema de marcações para PMEs com confirmações e lembretes automáticos por WhatsApp e SMS.",
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
        <Toaster />
      </body>
    </html>
  );
}
