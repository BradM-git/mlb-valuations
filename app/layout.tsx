// app/layout.tsx
import "./globals.css";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className="min-h-screen bg-slate-50 text-slate-900 antialiased"
      >
        {/* Global Header */}
        <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
            <Link
              href="/"
              className="text-sm font-extrabold tracking-tight text-slate-900"
            >
              MLB Valuations
            </Link>

            <nav className="flex items-center gap-5 text-sm font-semibold text-slate-700">
              {/* Browse Players intentionally removed from global nav */}
              <Link href="/methodology" className="hover:text-slate-900">
                Methodology
              </Link>
              <Link href="/compare" className="hover:text-slate-900">
                Compare
              </Link>
            </nav>
          </div>
        </header>

        {/* Page Content */}
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          {children}
        </main>

        {/* Footer (NO dynamic year — prevents hydration noise) */}
        <footer className="mx-auto max-w-6xl px-4 pb-10 pt-6 text-xs text-slate-500 sm:px-6">
          <div className="border-t border-slate-200 pt-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>© 2025 MLB Valuations</div>

              <div className="flex items-center gap-4">
                <Link href="/methodology" className="hover:text-slate-700">
                  Methodology
                </Link>
                <Link href="/compare" className="hover:text-slate-700">
                  Compare
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
