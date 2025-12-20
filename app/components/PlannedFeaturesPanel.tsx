"use client";

import { useEffect, useMemo, useState } from "react";

export type PlannedFeatureRow = {
  slug: string;
  title: string;
  description: string;
  votes: number;
  sort_order?: number;
};

function clampVotes(n: any) {
  const v = Number(n);
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

function mergeVotesPreserveOrder(
  base: PlannedFeatureRow[],
  incoming: PlannedFeatureRow[]
): PlannedFeatureRow[] {
  const incomingBySlug = new Map<string, PlannedFeatureRow>();
  for (const r of incoming) incomingBySlug.set(String(r.slug), r);

  const out: PlannedFeatureRow[] = base.map((r) => {
    const next = incomingBySlug.get(r.slug);
    if (!next) return r;
    return { ...r, votes: clampVotes(next.votes) };
  });

  // append any new rows that weren't in base (rare, but safe)
  const baseSlugs = new Set(base.map((r) => r.slug));
  for (const r of incoming) {
    if (!baseSlugs.has(r.slug)) out.push({ ...r, votes: clampVotes(r.votes) });
  }

  return out;
}

async function fetchPlannedFeatures(): Promise<PlannedFeatureRow[]> {
  const res = await fetch("/api/planned-features", { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /api/planned-features failed: ${res.status}`);
  const json = await res.json();
  const rows = Array.isArray(json?.rows) ? json.rows : [];
  return rows.map((r: any) => ({
    slug: String(r.slug ?? ""),
    title: String(r.title ?? ""),
    description: String(r.description ?? ""),
    votes: clampVotes(r.votes),
    sort_order: r.sort_order != null ? Number(r.sort_order) : undefined,
  }));
}

async function postVote(slug: string): Promise<number> {
  const res = await fetch("/api/planned-features", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug }),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      typeof json?.error === "string" ? json.error : `POST failed (${res.status})`;
    throw new Error(msg);
  }

  const votes = clampVotes(json?.votes);
  return votes;
}

function votesLabel(v: number) {
  return `${v} ${v === 1 ? "vote" : "votes"}`;
}

export function PlannedFeaturesPanel({
  initialRows,
}: {
  initialRows: PlannedFeatureRow[];
}) {
  // Keep stable display order — never reorder by votes.
  const stableInitial = useMemo(() => {
    const cleaned = (initialRows ?? [])
      .filter((r) => r?.slug)
      .map((r) => ({
        slug: String(r.slug),
        title: String(r.title ?? ""),
        description: String(r.description ?? ""),
        votes: clampVotes(r.votes),
        sort_order: r.sort_order,
      }));

    return cleaned; // preserve server-provided order
  }, [initialRows]);

  const [rows, setRows] = useState<PlannedFeatureRow[]>(stableInitial);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [votingSlug, setVotingSlug] = useState<string | null>(null);

  // On mount: hydrate votes from persisted DB state.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const fresh = await fetchPlannedFeatures();
        if (cancelled) return;
        setRows((prev) =>
          mergeVotesPreserveOrder(prev.length ? prev : stableInitial, fresh)
        );
        setError(null);
      } catch {
        if (cancelled) return;
        // Soft error; not fatal
        setError("Couldn’t load votes.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [stableInitial]);

  async function onVote(slug: string) {
    setError(null);

    // Optimistic bump
    setRows((prev) =>
      prev.map((r) => (r.slug === slug ? { ...r, votes: r.votes + 1 } : r))
    );

    setVotingSlug(slug);

    try {
      const persistedVotes = await postVote(slug);
      setRows((prev) =>
        prev.map((r) => (r.slug === slug ? { ...r, votes: persistedVotes } : r))
      );
      setError(null);
    } catch {
      // Revert optimistic bump
      setRows((prev) =>
        prev.map((r) =>
          r.slug === slug ? { ...r, votes: Math.max(0, r.votes - 1) } : r
        )
      );
      setError("Failed to vote.");
    } finally {
      setVotingSlug(null);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-200 px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              Planned Features
            </div>
            <div className="mt-1 text-xs text-slate-500">
              This list is intentionally public. Votes are unlimited for now while
              we test.
            </div>
          </div>

          <div className="flex items-center gap-2">
            {loading ? (
              <span className="inline-flex items-center gap-2 text-xs text-slate-500">
                <span className="h-2 w-2 rounded-full bg-slate-300" />
                Loading
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 text-xs text-slate-500">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Live
              </span>
            )}
          </div>
        </div>

        {error ? <div className="mt-2 text-xs text-red-600">{error}</div> : null}
      </div>

      {/* List */}
      <div className="divide-y divide-slate-200">
        {rows.length === 0 ? (
          <div className="px-6 py-8 text-sm text-slate-600">
            No planned features yet.
          </div>
        ) : (
          rows.map((r) => {
            const isVoting = votingSlug === r.slug;

            return (
              <div
                key={r.slug}
                className="px-6 py-4 hover:bg-slate-50 transition"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left: title/desc */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {r.title}
                      </div>
                      {/* subtle dot */}
                      <span className="hidden sm:inline-block h-1 w-1 rounded-full bg-slate-300" />
                    </div>
                    <div className="mt-1 text-sm text-slate-600 leading-relaxed">
                      {r.description}
                    </div>
                  </div>

                  {/* Right: votes + button */}
                  <div className="shrink-0 flex items-center gap-3">
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 tabular-nums">
                      {votesLabel(clampVotes(r.votes))}
                    </span>

                    <button
                      type="button"
                      onClick={() => onVote(r.slug)}
                      disabled={isVoting}
                      className={[
                        "inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold shadow-sm border",
                        isVoting
                          ? "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
                          : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
                      ].join(" ")}
                      aria-label={`Vote for ${r.title}`}
                      title="Like"
                    >
                      Like
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 px-6 py-4 bg-white">
        <div className="text-xs text-slate-500">
          This is feedback collection only — not a promise or timeline.
        </div>
      </div>
    </div>
  );
}

export default PlannedFeaturesPanel;
