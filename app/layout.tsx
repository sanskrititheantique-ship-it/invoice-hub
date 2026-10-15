import type { Metadata } from "next";
import "./globals.css";
import "./sheets.css";

export const metadata: Metadata = { title: "Invoice Hub", description: "GST invoices for Vyrelle, DT.live, LoudCousin and Sanskriti The Antique", robots: { index: false } };

const FONTS =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600" +
  "&family=Schibsted+Grotesk:wght@400;500;700;800&family=JetBrains+Mono:wght@400;500&family=Bricolage+Grotesque:opsz,wght@12..96,400..800" +
  "&family=IBM+Plex+Mono:wght@400;500&family=Marcellus&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Libre+Franklin:wght@400;500;600&display=swap";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body>{children}</body>
    </html>
  );
}
