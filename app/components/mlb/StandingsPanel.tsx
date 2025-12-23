// app/components/mlb/StandingsPanel.tsx
import { TabsClient, TabPanel, type TabDef } from "./TabsClient";

export const dynamic = "force-dynamic";

type StandingsRow = {
  teamName: string;
  wins: number;
  losses: number;
  pct: string;
  gb: string;
  runDiff?: number;
};

type DivisionBlock = {
  title: string;
  rows: StandingsRow[];
};

function num(n: any, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function str(v: any, fallback = "—") {
  const s = String(v ?? "").trim();
  return s ? s : fallback;
}

function pctStr(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(3).replace(/^0/, "");
}

async function fetchStandings(): Promise<{ al: DivisionBlock[]; nl: DivisionBlock[] }> {
  const url =
    "https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=2025&standingsTypes=regularSeason";

  // ✅ opt out of Next data cache
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) return { al: [], nl: [] };

  const json = await res.json();
  const records = Array.isArray(json?.records) ? json.records : [];

  const out: { al: DivisionBlock[]; nl: DivisionBlock[] } = { al: [], nl: [] };

  for (const div of records) {
    const leagueId = num(div?.league?.id, 0);
    const leagueKey = leagueId === 103 ? "al" : leagueId === 104 ? "nl" : null;
    if (!leagueKey) continue;

    const divisionName = str(div?.division?.name, "Division");
    const teamRecords = Array.isArray(div?.teamRecords) ? div.teamRecords : [];

    const rows: StandingsRow[] = teamRecords.map((tr: any) => {
      const wins = num(tr?.wins, 0);
      const losses = num(tr?.losses, 0);
      const pct = pctStr(tr?.winningPercentage);
      const gb = str(tr?.gamesBack, "—");

      const rs = Number(tr?.runsScored);
      const ra = Number(tr?.runsAllowed);
      const rd = Number.isFinite(rs) && Number.isFinite(ra) ? rs - ra : undefined;

      return {
        teamName: str(tr?.team?.name, "Unknown"),
        wins,
        losses,
        pct,
        gb,
        runDiff: rd,
      };
    });

    out[leagueKey].push({ title: divisionName, rows });
  }

  return out;
}

function StandingsTable({ block }: { block: DivisionBlock }) {
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
        <div className="text-xs font-semibold text-slate-700">{block.title}</div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white">
            <tr className="text-left text-xs font-semibold text-slate-500">
              <th className="px-4 py-2">Team</th>
              <th className="px-3 py-2 text-right">W</th>
              <th className="px-3 py-2 text-right">L</th>
              <th className="px-3 py-2 text-right">PCT</th>
              <th className="px-3 py-2 text-right">GB</th>
              <th className="px-3 py-2 text-right">RD</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200">
            {block.rows.map((r, idx) => (
              <tr key={`${r.teamName}-${r.wins}-${r.losses}-${idx}`} className="bg-white">
                <td className="px-4 py-2 font-semibold text-slate-900">{r.teamName}</td>
                <td className="px-3 py-2 text-right text-slate-700 tabular-nums">{r.wins}</td>
                <td className="px-3 py-2 text-right text-slate-700 tabular-nums">{r.losses}</td>
                <td className="px-3 py-2 text-right text-slate-700 tabular-nums">{r.pct}</td>
                <td className="px-3 py-2 text-right text-slate-700 tabular-nums">{r.gb}</td>
                <td className="px-3 py-2 text-right text-slate-700 tabular-nums">
                  {r.runDiff == null ? "—" : r.runDiff > 0 ? `+${r.runDiff}` : `${r.runDiff}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export async function StandingsPanel() {
  const { al, nl } = await fetchStandings();

  const tabs: TabDef[] = [
    { key: "al", label: "American League" },
    { key: "nl", label: "National League" },
  ];

  return (
    <div className="mv-panel">
      <div className="mv-panel-header">
        <div className="text-xl font-semibold tracking-tight text-slate-900">Standings</div>
        <div className="mt-2 text-xs text-slate-500">Season: 2025 (final / latest available)</div>
      </div>

      <div className="mv-panel-body">
        <TabsClient tabs={tabs} initialKey="al">
          <TabPanel tabKey="al">
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-4">
                {al.length ? al.map((b, i) => <StandingsTable key={`al-${b.title}-${i}`} block={b} />) : null}
                {!al.length ? <div className="text-sm text-slate-600">No standings data available.</div> : null}
              </div>
            </div>
          </TabPanel>

          <TabPanel tabKey="nl">
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-4">
                {nl.length ? nl.map((b, i) => <StandingsTable key={`nl-${b.title}-${i}`} block={b} />) : null}
                {!nl.length ? <div className="text-sm text-slate-600">No standings data available.</div> : null}
              </div>
            </div>
          </TabPanel>
        </TabsClient>
      </div>
    </div>
  );
}
