// app/components/mlb/LatestRumorsPanel.tsx
import { getLatestRumors } from "@/lib/mlbRumors";

export const dynamic = "force-dynamic";

export async function LatestRumorsPanel() {
  const rows = await getLatestRumors(5);

  return (
    <div className="mv-panel">
      <div className="mv-panel-header">
        <div className="text-xl font-semibold tracking-tight text-slate-900">Latest Rumors</div>
      </div>

      {rows.length === 0 ? (
        <div className="px-6 py-6 text-sm text-slate-600">No feed items found.</div>
      ) : (
        <div className="mv-panel-body">
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.id} className="min-w-0">
                <a
                  href={r.link}
                  target="_blank"
                  rel="noreferrer"
                  className="block hover:opacity-90"
                  title="Open source"
                >
                  <div className="truncate text-sm font-semibold text-slate-900">
                    {r.title} <span className="text-slate-400">↗</span>
                  </div>

                  <div className="mt-1 flex items-center justify-between gap-3 text-xs text-slate-500">
                    <span className="truncate">{r.source}</span>
                    <span className="shrink-0 tabular-nums">{r.ymd || "—"}</span>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
