import type { Metadata, Viewport } from "next";
import { Caveat, Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });
const hand = Caveat({ subsets: ["latin", "latin-ext"], variable: "--font-caveat" });

export const metadata: Metadata = {
  title: "Postcard Atlas",
  description: "Every postcard our group sends, on one map.",
  applicationName: "Postcard Atlas",
  // "Add to Home Screen" on iPhone: full-screen, with a short name under the icon
  appleWebApp: { capable: true, title: "Postcards", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // lets the tab bar sit above the iPhone home indicator
  themeColor: "#f6f0e4",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${mono.variable} ${hand.variable}`}>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
