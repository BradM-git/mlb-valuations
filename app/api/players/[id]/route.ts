// app/api/players/[id]/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { getPlayerValuation } from "@/lib/valuation";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const playerId = Number(id);

  if (!Number.isFinite(playerId) || playerId <= 0) {
    return NextResponse.json(
      { error: `Invalid player id: ${id || "undefined"}` },
      { status: 400 }
    );
  }

  const { data: player, error: pErr } = await supabase
    .from("players")
    .select("id,name,team,position,age,tps,games_played,image_url")
    .eq("id", playerId)
    .maybeSingle();

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (!player)
    return NextResponse.json({ error: "Player not found" }, { status: 404 });

  // ✅ Include team per season (if populated in DB)
  const { data: seasons, error: sErr } = await supabase
    .from("player_seasons")
    .select("season,tps,games_played,war,team")
    .eq("player_id", playerId)
    .order("season", { ascending: false });

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  const { valuation, historicalData } = getPlayerValuation(player, seasons ?? []);

  return NextResponse.json({
    player,
    seasons: seasons ?? [],
    valuation,
    historicalData,
  });
}
