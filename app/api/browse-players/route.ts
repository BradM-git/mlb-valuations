// app/api/browse-players/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function clampInt(v: string | null, min: number, max: number, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function normalizeQuery(q: string | null) {
  const s = (q ?? "").trim();
  return s.length ? s : "";
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const q = normalizeQuery(url.searchParams.get("q"));
    const page = clampInt(url.searchParams.get("bp"), 1, 999, 1);
    const pageSize = clampInt(url.searchParams.get("bps"), 1, 50, 10);

    // latest season
    const { data: maxSeasonRow, error: maxErr } = await supabase
      .from("player_seasons")
      .select("season")
      .order("season", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxErr) throw maxErr;
    const latestSeason = maxSeasonRow?.season ?? null;

    // count
    const countQuery = supabase.from("players").select("id", { count: "exact", head: true });
    if (q) countQuery.ilike("name", `%${q}%`);
    const { count, error: countErr } = await countQuery;
    if (countErr) throw countErr;

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let playersQuery = supabase
      .from("players")
      .select("id,name,team,position,age,image_url")
      .order("name", { ascending: true })
      .range(from, to);

    if (q) playersQuery = playersQuery.ilike("name", `%${q}%`);

    const { data: players, error: playersErr } = await playersQuery;
    if (playersErr) throw playersErr;

    const playerIds = (players ?? []).map((p) => p.id);

    const warMap = new Map<number, number | null>();
    if (latestSeason && playerIds.length) {
      const { data: seasonRows, error: seasonErr } = await supabase
        .from("player_seasons")
        .select("player_id, war, season")
        .eq("season", latestSeason)
        .in("player_id", playerIds);

      if (seasonErr) throw seasonErr;
      (seasonRows ?? []).forEach((r: any) => warMap.set(r.player_id, r.war ?? null));
    }

    const rows = (players ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      team: p.team ?? null,
      position: p.position ?? null,
      age: p.age ?? null,
      image_url: p.image_url ?? null,
      war: warMap.has(p.id) ? warMap.get(p.id)! : null,
      season: latestSeason,
    }));

    return NextResponse.json({ rows, total: count ?? 0 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "browse route failed" },
      { status: 500 }
    );
  }
}
