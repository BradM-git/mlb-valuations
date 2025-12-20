// app/teams/[slug]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function unslug(input: unknown) {
  const slug = String(input ?? "").trim();
  if (!slug) return "Team";

  // Best-effort display: "new-york-yankees" -> "New York Yankees"
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default async function TeamPage({
  params,
}: {
  // Some pages in this codebase use Promise<params>; support both shapes defensively.
  params: { slug?: string } | Promise<{ slug?: string }>;
}) {
  const resolved = (await Promise.resolve(params)) as { slug?: string };
  const slug = resolved?.slug;

  if (!slug) notFound();

  const teamName = unslug(slug);

  return (
    <div className="text-base">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="p-8 sm:p-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900">{teamName}</h1>
              <p className="mt-3 max-w-3xl text-lg leading-relaxed text-slate-600">
                This team page is a placeholder for now. The goal will be the same as player pages: clear
                signals about what&apos;s changing — without turning it into hype or guesses.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/teams"
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50 shadow-sm"
              >
                Back to Teams
              </Link>
              <Link
                href="/#browse"
                className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 shadow-sm"
              >
                Browse Players
              </Link>
            </div>
          </div>

          <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-6">
            <div className="text-sm font-semibold text-slate-900">Coming soon</div>
            <ul className="mt-3 space-y-2 text-sm text-slate-700 list-disc pl-6">
              <li>Key players and recent movement signals</li>
              <li>Year-over-year direction, with defensible context</li>
              <li>Links into relevant player profiles (no “picks” framing)</li>
            </ul>

            <div className="mt-5 text-xs text-slate-500">
              URL slug: <span className="font-mono text-slate-700">{slug}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
