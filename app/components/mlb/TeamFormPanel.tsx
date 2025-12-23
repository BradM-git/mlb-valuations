// app/components/mlb/TeamFormPanel.tsx
import { TabsClient, TabPanel, type TabDef } from "./TabsClient";

export const dynamic = "force-dynamic";

type GameMini = {
  date: string; // YYYY-MM-DD
  opponent: string;
  isHome: boolean;
  teamScore: number;
  oppScore: number;
  result: "W" | "L";
};

type TeamForm = {
  teamName: string;
  league: "AL" | "NL";
  division: string;
  last5: GameMini[];
};

function str(v: any, fallback = "—") {
  const s = String(v ?? "").trim();
  return s ? s : fallback;
}

function num(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function ymd(dateIso: string) {
  return String(dateIso ?? "").slice(0, 10);
}

async function fetchAllFinalGames2025(): Promise<any[]> {
  const url =
    "https://statsapi.mlb.com/api/v1/schedule?sportId=1&season=2025&gameTypes=R&hydrate=team,linescore&startDate=2025-03-01&endDate=2025-11-30";

  // ✅ avoid Next data cache (payload is huge)
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) return [];
  const json = await res.json();
  const dates = Array.isArray(json?.dates) ? json.dates : [];
  const games: any[] = [];
  for (const d of dates) {
    const ds = String(d?.date ?? "");
    const gs = Array.isArray(d?.games) ? d.games : [];
    for (const g of gs) {
      const state = String(g?.status?.detailedState ?? "");
      if (state !== "Final" && state !== "Game Over") continue;
      games.push({ date: ds, game: g });
    }
  }
  return games;
}

async function buildTeamForms(): Promise<TeamForm[]> {
  const all = await fetchAllFinalGames2025();
  if (all.length === 0) return [];

  const byTeamId = new Map<number, TeamForm>();

  for (const item of all) {
    const date = String(item?.date ?? "");
    const g = item?.game;

    const away = g?.teams?.away?.team;
    const home = g?.teams?.home?.team;

    const awayScore = num(g?.teams?.away?.score, NaN);
    const homeScore = num(g?.teams?.home?.score, NaN);
    if (!Number.isFinite(awayScore) || !Number.isFinite(homeScore)) continue;

    const awayId = num(away?.id, NaN);
    const homeId = num(home?.id, NaN);
    if (!Number.isFinite(awayId) || !Number.isFinite(homeId)) continue;

    const awayLeague = str(away?.league?.name, "").includes("American") ? "AL" : "NL";
    const homeLeague = str(home?.league?.name, "").includes("American") ? "AL" : "NL";

    const awayDiv = str(away?.division?.name, "Division");
    const homeDiv = str(home?.division?.name, "Division");

    const awayName = str(away?.name, "Away");
    const homeName = str(home?.name, "Home");

    // Away perspective
    {
      const tf =
        byTeamId.get(awayId) ??
        ({
          teamName: awayName,
          league: awayLeague,
          division: awayDiv,
          last5: [],
        } as TeamForm);

      const result: "W" | "L" = awayScore > homeScore ? "W" : "L";

      tf.last5.push({
        date: ymd(date),
        opponent: homeName,
        isHome: false,
        teamScore: awayScore,
        oppScore: homeScore,
        result,
      });

      byTeamId.set(awayId, tf);
    }

    // Home perspective
    {
      const tf =
        byTeamId.get(homeId) ??
        ({
          teamName: homeName,
          league: homeLeague,
          division: homeDiv,
          last5: [],
        } as TeamForm);

      const result: "W" | "L" = homeScore > awayScore ? "W" : "L";

      tf.last5.push({
        date: ymd(date),
        opponent: awayName,
        isHome: true,
        teamScore: homeScore,
        oppScore: awayScore,
        result,
      });

      byTeamId.set(homeId, tf);
    }
  }

  const teams = Array.from(byTeamId.values()).map((t) => {
    const sorted = t.last5
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .slice(0, 5);
    return { ...t, last5: sorted };
  });

  teams.sort((a, b) => a.teamName.localeCompare(b.teamName));
  return teams;
}

function Dot({ g }: { g: GameMini }) {
  const title = `${g.date} · ${g.isHome ? "vs" : "@"} ${g.opponent} · ${g.teamScore}-${g.oppScore} (${g.result})`;
  const base = "inline-flex h-7 w-7 items-center justify-center rounded-md border text-xs font-bold shadow-sm";
  const cls =
    g.result === "W"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-rose-200 bg-rose-50 text-rose-800";

  return (
    <span title={title} className={`${base} ${cls}`}>
      {g.result}
    </span>
  );
}

function TeamRow({ t }: { t: TeamForm }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-slate-900">{t.teamName}</div>
        <div className="truncate text-xs text-slate-500">{t.division}</div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {t.last5.map((g, idx) => (
          <Dot key={`${t.teamName}-${g.date}-${idx}`} g={g} />
        ))}
      </div>
    </div>
  );
}

export async function TeamFormPanel() {
  const all = await buildTeamForms();

  const tabs: TabDef[] = [
    { key: "al", label: "American League" },
    { key: "nl", label: "National League" },
  ];

  const groups = {
    al: {
      "AL East": all.filter((t) => t.league === "AL" && t.division.includes("East")),
      "AL Central": all.filter((t) => t.league === "AL" && t.division.includes("Central")),
      "AL West": all.filter((t) => t.league === "AL" && t.division.includes("West")),
    },
    nl: {
      "NL East": all.filter((t) => t.league === "NL" && t.division.includes("East")),
      "NL Central": all.filter((t) => t.league === "NL" && t.division.includes("Central")),
      "NL West": all.filter((t) => t.league === "NL" && t.division.includes("West")),
    },
  };

  const renderBlock = (title: string, rows: TeamForm[]) => (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
        <div className="text-xs font-semibold text-slate-700">{title}</div>
      </div>
      <div className="divide-y divide-slate-200 px-4">
        {rows.length ? rows.map((t) => <TeamRow key={t.teamName} t={t} />) : <div className="py-3 text-sm text-slate-600">No data.</div>}
      </div>
    </div>
  );

  return (
    <div className="mv-panel">
      <div className="mv-panel-header">
        <div className="text-xl font-semibold tracking-tight text-slate-900">Team Form</div>
        <div className="mt-2 text-xs text-slate-500">Last 5 completed games (2025 season)</div>
      </div>

      <div className="mv-panel-body">
        <TabsClient tabs={tabs} initialKey="al">
          <TabPanel tabKey="al">
            <div className="space-y-3">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">American League</div>
              <div className="grid grid-cols-1 gap-4">
                {renderBlock("AL East", groups.al["AL East"])}
                {renderBlock("AL Central", groups.al["AL Central"])}
                {renderBlock("AL West", groups.al["AL West"])}
              </div>
            </div>
          </TabPanel>

          <TabPanel tabKey="nl">
            <div className="space-y-3">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">National League</div>
              <div className="grid grid-cols-1 gap-4">
                {renderBlock("NL East", groups.nl["NL East"])}
                {renderBlock("NL Central", groups.nl["NL Central"])}
                {renderBlock("NL West", groups.nl["NL West"])}
              </div>
            </div>
          </TabPanel>
        </TabsClient>
      </div>
    </div>
  );
}
