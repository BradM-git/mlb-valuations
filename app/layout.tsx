import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { GlobalNav } from "./components/GlobalNav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "MLB Valuations",
    template: "%s · MLB Valuations",
  },
  description:
    "Authoritative MLB performance signals focused on recent impact and trajectory. Built for fans, fantasy research, and betting-adjacent context (not picks).",
  metadataBase: new URL("https://mlb-valuations.vercel.app"),
  openGraph: {
    title: "MLB Valuations",
    description:
      "Authoritative MLB performance signals focused on recent impact and trajectory. Built for fans, fantasy research, and betting-adjacent context (not picks).",
    type: "website",
    url: "https://mlb-valuations.vercel.app",
    siteName: "MLB Valuations",
  },
  twitter: {
    card: "summary_large_image",
    title: "MLB Valuations",
    description:
      "Authoritative MLB performance signals focused on recent impact and trajectory. Built for fans, fantasy research, and betting-adjacent context (not picks).",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <GlobalNav />
        <div className="pt-6">{children}</div>
      </body>
    </html>
  );
}
