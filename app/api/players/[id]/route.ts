import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getPlayerValuation } from "@/lib/valuation";

export const dynamic = "force-dynamic";

function extractId(req: Request, params?: { id?: string }) {
  const fromParams = params?.id;
  if (fromParams) return fromParams;

  // Fallback: parse last path segment
  const pathname = new URL(req.url).pathname;
  const seg = pathname.split("/").filter(Boolean).pop();
  return seg ?? "";
}

export async function GET(req: Request, ctx: { params?: { id?: string } }) {
  const rawId = extractId(req, ctx?.params);
  const playerId = Number(rawId);

  if (!Number.isFinite(playerId) || playerId <= 0) {
    return NextResponse.json(
      { error: `Invalid player id: ${rawId || "undefined"}` },
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

  // ✅ INCLUDE team per season so charts can render correct logos
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
