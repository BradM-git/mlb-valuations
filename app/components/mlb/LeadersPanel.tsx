// app/components/mlb/LeadersPanel.tsx
import Link from "next/link";
import { TabsClient, TabPanel, type TabDef } from "./TabsClient";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type LeaderItem = {
  playerId: number;
  name: string;
  team: string | null;
  position: string | null;
  image_url: string | null;
  value: number;
};

function num(n: any, fallback = NaN) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function fmt(n: number, digits = 0) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

async function getTopByStat(opts: {
  season: number;
  statKey:
    | "homeRuns"
    | "rbi"
    | "stolenBases"
    | "battingAverage"
    | "ops"
    | "era"
    | "strikeOuts"
    | "wins"
    | "saves";
  limit: number;
}): Promise<LeaderItem[]> {
  const { season, statKey, limit } = opts;

  const pitchingStats = new Set(["era", "strikeOuts", "wins", "saves"]);
  const group = pitchingStats.has(statKey) ? "pitching" : "hitting";

  const url = `https://statsapi.mlb.com/api/v1/stats/leaders?leaderCategories=${statKey}&season=${season}&leaderGameTypes=R&limit=${limit}&statGroup=${group}`;

  // ✅ opt out of Next data cache (safe + consistent)
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) return [];

  const json = await res.json();
  const leaders = Array.isArray(json?.leagueLeaders?.[0]?.leaders) ? json.leagueLeaders[0].leaders : [];

  const names = leaders
    .map((l: any) => String(l?.person?.fullName ?? "").trim())
    .filter(Boolean);
  if (names.length === 0) return [];

  const { data: localPlayers } = await supabase
    .from("players")
    .select("id,name,team,position,image_url")
    .in("name", names);

  const byNameTeam = new Map<string, any>();
  for (const p of localPlayers ?? []) {
    const key = `${String((p as any).name ?? "").toLowerCase()}__${String((p as any).team ?? "").toLowerCase()}`;
    byNameTeam.set(key, p);
  }

  const out: LeaderItem[] = [];
  for (const l of leaders) {
    const name = String(l?.person?.fullName ?? "").trim();
    const team = String(l?.team?.name ?? "").trim() || null;
    const value = num(l?.value, NaN);
    if (!name || !Number.isFinite(value)) continue;

    const key = `${name.toLowerCase()}__${String(team ?? "").toLowerCase()}`;
    const local = byNameTeam.get(key);
    if (!local) continue;

    out.push({
      playerId: Number((local as any).id),
      name: String((local as any).name ?? name),
      team: (local as any).team ?? team,
      position: (local as any).position ?? null,
      image_url: (local as any).image_url ?? null,
      value,
    });
  }

  return out;
}

function Row({ item, digits }: { item: LeaderItem; digits?: number }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <Link href={`/players/${item.playerId}`} className="flex items-center gap-3 min-w-0" prefetch={false}>
        <div className="h-9 w-9 overflow-hidden rounded-full border border-slate-200 bg-slate-100 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {item.image_url ? (
            <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
          ) : null}
        </div>

        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900">{item.name}</div>
          <div className="truncate text-xs text-slate-500">
            {(item.team ?? "Unknown")} · {(item.position ?? "—")}
          </div>
        </div>
      </Link>

      <div className="shrink-0 text-sm font-semibold text-slate-900 tabular-nums">
        {digits != null ? fmt(item.value, digits) : fmt(item.value, 0)}
      </div>
    </li>
  );
}

export async function LeadersPanel() {
  const season = 2025;

  const tabs: TabDef[] = [
    { key: "hit", label: "Hitters" },
    { key: "pit", label: "Pitchers" },
  ];

  const [hr, rbi, sb, ops, era, so, wins, saves] = await Promise.all([
    getTopByStat({ season, statKey: "homeRuns", limit: 5 }),
    getTopByStat({ season, statKey: "rbi", limit: 5 }),
    getTopByStat({ season, statKey: "stolenBases", limit: 5 }),
    getTopByStat({ season, statKey: "ops", limit: 5 }),
    getTopByStat({ season, statKey: "era", limit: 5 }),
    getTopByStat({ season, statKey: "strikeOuts", limit: 5 }),
    getTopByStat({ season, statKey: "wins", limit: 5 }),
    getTopByStat({ season, statKey: "saves", limit: 5 }),
  ]);

  return (
    <div className="mv-panel">
      <div className="mv-panel-header">
        <div className="text-xl font-semibold tracking-tight text-slate-900">League Leaders</div>
        <div className="mt-2 text-xs text-slate-500">Season: 2025 (regular season)</div>
      </div>

      <div className="mv-panel-body">
        <TabsClient tabs={tabs} initialKey="hit">
          <TabPanel tabKey="hit">
            <div className="space-y-4">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Hitters</div>

              <div className="grid grid-cols-1 gap-6">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Home Runs</div>
                  <ul className="mt-3 space-y-3">
                    {hr.length ? hr.map((x) => <Row key={`hr-${x.playerId}`} item={x} />) : <div className="text-sm text-slate-600">No data.</div>}
                  </ul>
                </div>

                <div>
                  <div className="text-sm font-semibold text-slate-900">RBI</div>
                  <ul className="mt-3 space-y-3">
                    {rbi.length ? rbi.map((x) => <Row key={`rbi-${x.playerId}`} item={x} />) : <div className="text-sm text-slate-600">No data.</div>}
                  </ul>
                </div>

                <div>
                  <div className="text-sm font-semibold text-slate-900">Stolen Bases</div>
                  <ul className="mt-3 space-y-3">
                    {sb.length ? sb.map((x) => <Row key={`sb-${x.playerId}`} item={x} />) : <div className="text-sm text-slate-600">No data.</div>}
                  </ul>
                </div>

                <div>
                  <div className="text-sm font-semibold text-slate-900">OPS</div>
                  <ul className="mt-3 space-y-3">
                    {ops.length ? ops.map((x) => <Row key={`ops-${x.playerId}`} item={x} digits={3} />) : <div className="text-sm text-slate-600">No data.</div>}
                  </ul>
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel tabKey="pit">
            <div className="space-y-4">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Pitchers</div>

              <div className="grid grid-cols-1 gap-6">
                <div>
                  <div className="text-sm font-semibold text-slate-900">ERA</div>
                  <ul className="mt-3 space-y-3">
                    {era.length ? era.map((x) => <Row key={`era-${x.playerId}`} item={x} digits={2} />) : <div className="text-sm text-slate-600">No data.</div>}
                  </ul>
                </div>

                <div>
                  <div className="text-sm font-semibold text-slate-900">Strikeouts</div>
                  <ul className="mt-3 space-y-3">
                    {so.length ? so.map((x) => <Row key={`so-${x.playerId}`} item={x} />) : <div className="text-sm text-slate-600">No data.</div>}
                  </ul>
                </div>

                <div>
                  <div className="text-sm font-semibold text-slate-900">Wins</div>
                  <ul className="mt-3 space-y-3">
                    {wins.length ? wins.map((x) => <Row key={`w-${x.playerId}`} item={x} />) : <div className="text-sm text-slate-600">No data.</div>}
                  </ul>
                </div>

                <div>
                  <div className="text-sm font-semibold text-slate-900">Saves</div>
                  <ul className="mt-3 space-y-3">
                    {saves.length ? saves.map((x) => <Row key={`sv-${x.playerId}`} item={x} />) : <div className="text-sm text-slate-600">No data.</div>}
                  </ul>
                </div>
              </div>
            </div>
          </TabPanel>

          <div className="mt-6 text-xs text-slate-500">
            Note: leaders are fetched from MLB Stats API and matched to your local players table for headshots/links.
          </div>
        </TabsClient>
      </div>
    </div>
  );
}
