// app/components/mlb/LatestTransfersPanel.tsx
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getLatestTransfers } from "@/lib/mlbTransactions";
import { PlayerAvatar } from "@/app/components/PlayerAvatar.client";

export const dynamic = "force-dynamic";

function toYmd(s: string) {
  const raw = String(s ?? "").trim();
  if (!raw) return "—";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function line(item: {
  type: string;
  fromTeam?: string | null;
  toTeam?: string | null;
  description?: string | null;
}) {
  const t = item.type || "Transaction";

  if (item.fromTeam || item.toTeam) {
    const from = item.fromTeam ?? "—";
    const to = item.toTeam ?? "—";
    return `${t} · ${from} → ${to}`;
  }

  const desc = (item.description ?? "").trim();
  return desc ? `${t} · ${desc}` : t;
}

type PlayerLookup = {
  id: number;
  name: string;
  image_url: string | null;
};

export async function LatestTransfersPanel() {
  const rows = await getLatestTransfers(5);

  // Link to player page when we can match to DB
  const names = Array.from(new Set(rows.map((r) => String((r as any).playerName ?? "").trim()).filter(Boolean)));
  const byName = new Map<string, PlayerLookup>();

  if (names.length) {
    const { data, error } = await supabase.from("players").select("id,name,image_url").in("name", names);
    if (!error) {
      for (const p of data ?? []) {
        const id = Number((p as any).id);
        const name = String((p as any).name ?? "").trim();
        if (!Number.isFinite(id) || !name) continue;
        byName.set(name, { id, name, image_url: (p as any).image_url ?? null });
      }
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-200 px-6 py-4">
        <div className="text-xl font-semibold tracking-tight text-slate-900">Latest Transfers</div>
      </div>

      {rows.length === 0 ? (
        <div className="px-6 py-6 text-sm text-slate-600">No recent transactions found.</div>
      ) : (
        <div className="p-6">
          <ul className="space-y-4">
            {rows.map((r: any) => {
              const playerName = String(r.playerName ?? "").trim();
              const db = byName.get(playerName) ?? null;
              const href = db ? `/players/${db.id}` : null;

              // We no longer rely on any MLB personId field.
              // Candidate list: DB image_url only (then initials fallback handled by PlayerAvatar).
              const candidates = [db?.image_url ?? null];

              const RowWrap: any = href ? Link : "div";
              const rowProps = href
                ? { href, prefetch: false, className: "flex items-start justify-between gap-4 hover:opacity-95" }
                : { className: "flex items-start justify-between gap-4" };

              return (
                <li key={String(r.id ?? `${playerName}-${r.date ?? ""}-${r.type ?? ""}`)}>
                  <RowWrap {...rowProps}>
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-10 w-10 overflow-hidden rounded-full border border-slate-200 bg-slate-100 shrink-0">
                        <PlayerAvatar
                          alt={playerName || "—"}
                          candidates={candidates}
                          className="h-full w-full object-cover"
                          wrapperClassName="h-full w-full flex items-center justify-center rounded-full bg-slate-100 text-slate-700 border border-slate-200"
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{playerName || "Unknown"}</div>
                        <div className="mt-1 text-xs text-slate-600">
                          {line({
                            type: String(r.type ?? ""),
                            fromTeam: r.fromTeam ?? null,
                            toTeam: r.toTeam ?? null,
                            description: r.description ?? null,
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 text-xs text-slate-500 tabular-nums">{toYmd(String(r.date ?? ""))}</div>
                  </RowWrap>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
