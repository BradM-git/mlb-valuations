// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "MLB Valuations",
  description: "WAR-first MLB player valuations",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        {/* Global Nav */}
        <header className="sticky top-0 z-50 border-b border-slate-800 bg-black">
          <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
            <Link
              href="/"
              className="text-xl font-bold tracking-tight text-white hover:opacity-90"
            >
              MLB Valuations
            </Link>

            <nav className="flex items-center gap-6 text-sm font-medium text-slate-300">
            </nav>
          </div>
        </header>

        {/* Page content */}
        <main className="mx-auto max-w-6xl px-4 py-10 pt-14">{children}</main>

        {/* Global Footer */}
        <footer className="mt-12 border-t border-slate-800 bg-black">
          <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-400">
            © MLB Valuations — WAR-first valuations. Not affiliated with MLB.
          </div>
        </footer>
      </body>
    </html>
  );
}
