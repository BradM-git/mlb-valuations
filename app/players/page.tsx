// app/players/page.tsx
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function PlayersIndexPage() {
  // Players index is intentionally hidden (Browse Players lives on homepage).
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-8">
      <div className="text-2xl font-bold text-slate-900">Players (index hidden)</div>
      <div className="mt-2 text-sm text-slate-600">
        Browse Players now lives on the homepage panel.
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/#browse"
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Go to Browse →
        </Link>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
