import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getPlayerValuation } from '@/lib/valuation'

export const dynamic = 'force-dynamic'

function toInt(v: string | null, def: number) {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : def
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)

  const page = toInt(searchParams.get('page'), 1)
  const pageSize = toInt(searchParams.get('pageSize'), 25)
  const offset = (page - 1) * pageSize

  const name = (searchParams.get('name') ?? '').trim()
  const team = (searchParams.get('team') ?? '').trim()
  const position = (searchParams.get('position') ?? '').trim()

  let q = supabase
    .from('players')
    .select(
      `id,name,team,position,age,tps,games_played,image_url`,
      { count: 'exact' }
    )

  if (name) q = q.ilike('name', `%${name}%`)
  if (team) q = q.eq('team', team)
  if (position) q = q.eq('position', position)

  const { data: players, count, error: playersError } = await q
    .order('id', { ascending: true })
    .range(offset, offset + pageSize - 1)

  if (playersError) {
    return NextResponse.json({ error: playersError.message }, { status: 500 })
  }

  const safePlayers = players ?? []
  if (safePlayers.length === 0) {
    return NextResponse.json({
      page,
      pageSize,
      total: count ?? 0,
      rows: [],
    })
  }

  const playerIds = safePlayers.map(p => p.id)

  // ✅ IMPORTANT: include WAR here
  const { data: seasons, error: seasonsError } = await supabase
    .from('player_seasons')
    .select('player_id,season,tps,games_played,war')
    .in('player_id', playerIds)

  if (seasonsError) {
    return NextResponse.json({ error: seasonsError.message }, { status: 500 })
  }

  const seasonsByPlayer = new Map<number, any[]>()
  for (const s of seasons ?? []) {
    const pid = s.player_id
    if (!seasonsByPlayer.has(pid)) seasonsByPlayer.set(pid, [])
    seasonsByPlayer.get(pid)!.push(s)
  }

  const rows = safePlayers.map(player => {
    const playerSeasons = seasonsByPlayer.get(player.id) ?? []
    const { valuation } = getPlayerValuation(player, playerSeasons)
    return { ...player, valuation }
  })

  rows.sort(
    (a, b) =>
      (b.valuation?.tradeValueIndex ?? 0) - (a.valuation?.tradeValueIndex ?? 0)
  )

  return NextResponse.json({
    apiVersion: 'WAR_PLAYERS_LIST_V1',
    page,
    pageSize,
    total: count ?? safePlayers.length,
    rows,
  })
}
