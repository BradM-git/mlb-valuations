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
        <header className="sticky top-0 z-50 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-extrabold text-white"
                style={{
                  background:
                  "linear-gradient(135deg, #4f46e5 0%, #0ea5e9 55%, #10b981 100%)",
                }}
              >
                MV
              </div>
              <span className="text-xl font-extrabold tracking-tight text-slate-900">
                MLB Valuations
              </span>
            </Link>

            {/* Nav removed per request */}
            <div />
          </div>

          {/* Gradient divider */}
          <div
            className="h-[2px] w-full"
            style={{
              background:
              "linear-gradient(90deg, #4f46e5 0%, #0ea5e9 55%, #10b981 100%)",
            }}
          />
        </header>

        {/* Page Content */}
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          {children}
        </main>

        {/* Footer */}
        <footer className="mx-auto max-w-6xl px-4 pb-10 pt-6 text-xs text-slate-500 sm:px-6">
          <div className="border-t border-slate-200 pt-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>© 2025 MLB Valuations</div>

              {/* Footer links removed per request */}
              <div />
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
