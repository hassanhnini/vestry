import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: { default: "Vestry — your wardrobe, edited", template: "%s · Vestry" },
  description: "Digitise the clothes you own and get outfits styled from your real wardrobe.",
  applicationName: "Vestry",
  appleWebApp: { capable: true, title: "Vestry", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#f5f0e8",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
