import Link from "next/link";

export function GlobalNav() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <Link
            href="/"
            className="text-sm font-extrabold tracking-tight text-slate-900 hover:opacity-90"
          >
            MLB Valuations
          </Link>

          <nav className="flex items-center gap-6 text-sm font-semibold text-slate-700">
            <Link href="/players" className="hover:text-slate-900">
              Browse Players
            </Link>

            <Link href="/methodology" className="hover:text-slate-900">
              How This Works
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
