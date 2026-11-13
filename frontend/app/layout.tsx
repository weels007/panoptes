import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Panoptes — Decentralized Content Moderation",
  description:
    "AI validators adjudicate content through Optimistic Democracy. Fixed confidence thresholds — not the model — decide ALLOW, FLAG, or BLOCK. Fully public audit log on GenLayer.",
  manifest: "/site.webmanifest",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#f2f4f8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
