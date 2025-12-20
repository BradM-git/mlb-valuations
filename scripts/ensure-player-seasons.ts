// scripts/ensure-player-seasons.ts
// Ensures every player has a player_seasons row for the given season.
// Idempotent: only inserts missing rows; does NOT overwrite existing war/games_played.

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing env vars. Need SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function inferMostRecentCompletedSeason(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11
  // Nov/Dec => offseason => current year treated as most recent completed season
  return month >= 10 ? year : year - 1;
}

async function fetchAllPlayerIds(): Promise<number[]> {
  const ids: number[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("players")
      .select("id")
      .order("id", { ascending: true })
      .range(from, to);

    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data as { id: number }[]) ids.push(row.id);
    if (data.length < pageSize) break;

    from += pageSize;
  }

  return ids;
}

async function fetchExistingSeasonPlayerIds(season: number): Promise<Set<number>> {
  const existing = new Set<number>();
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("player_seasons")
      .select("player_id")
      .eq("season", season)
      .order("player_id", { ascending: true })
      .range(from, to);

    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data as { player_id: number }[]) existing.add(row.player_id);
    if (data.length < pageSize) break;

    from += pageSize;
  }

  return existing;
}

async function insertMissingSeasonRows(playerIds: number[], season: number) {
  const existing = await fetchExistingSeasonPlayerIds(season);

  const missing = playerIds.filter((id) => !existing.has(id));
  if (missing.length === 0) {
    console.log(`✅ player_seasons already complete for season ${season} (${playerIds.length} players).`);
    return;
  }

  console.log(`Found ${missing.length} missing player_seasons rows for season ${season}. Inserting...`);

  // Insert in chunks to avoid payload limits
  const chunkSize = 500;
  for (let i = 0; i < missing.length; i += chunkSize) {
    const chunk = missing.slice(i, i + chunkSize);

    const payload = chunk.map((player_id) => ({
      player_id,
      season,
      war: null,
      games_played: null,
    }));

    const { error } = await supabase.from("player_seasons").insert(payload);

    if (error) {
      console.error("Insert chunk failed:", error);
      process.exit(1);
    }

    console.log(`  Inserted ${i + chunk.length}/${missing.length}`);
  }

  console.log(`✅ Inserted all missing rows for season ${season}.`);
}

async function main() {
  const seasonArg = process.argv.find((a) => a.startsWith("--season="));
  const season = seasonArg ? Number(seasonArg.split("=")[1]) : inferMostRecentCompletedSeason();

  if (!Number.isFinite(season) || season < 1900 || season > 3000) {
    console.error("Invalid season. Use --season=YYYY");
    process.exit(1);
  }

  console.log(`Ensuring full player_seasons coverage for season ${season}...`);

  const playerIds = await fetchAllPlayerIds();
  console.log(`Players in 'players' table: ${playerIds.length}`);

  await insertMissingSeasonRows(playerIds, season);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
