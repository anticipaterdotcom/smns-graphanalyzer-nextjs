import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import PwaShell from "@/components/PwaShell";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Staatliches Museum für Naturkunde Stuttgart - Graph Analyzer",
  description: "Signal analysis & pattern detection",
  manifest: "/manifest.webmanifest",
  applicationName: "SMNS Graph Analyzer",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Graph Analyzer",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased bg-black text-white`}>
        {children}
        <PwaShell />
      </body>
    </html>
  );
}
