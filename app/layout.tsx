import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const fraunces = localFont({ src: "../assets/fonts/fraunces-latin.woff2", variable: "--font-fraunces", weight: "100 900" });
const inter = localFont({ src: "../assets/fonts/inter-latin.woff2", variable: "--font-inter", weight: "100 900" });
const mono = localFont({ src: "../assets/fonts/jetbrains-latin.woff2", variable: "--font-jetbrains", weight: "100 800" });
const hand = localFont({ src: "../assets/fonts/caveat-latin.woff2", variable: "--font-caveat", weight: "400 700" });

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
