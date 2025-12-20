// app/api/planned-features/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing env NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Missing env SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET() {
  try {
    const sb = admin();

    const { data, error } = await sb
      .from("planned_features")
      .select("slug,title,description,votes,sort_order,created_at")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ rows: data ?? [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const sb = admin();

    const body = (await req.json().catch(() => ({}))) as { slug?: string };
    const slug = String(body.slug ?? "").trim();

    if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

    // find the row by slug
    const { data: row, error: findErr } = await sb
      .from("planned_features")
      .select("id, votes")
      .eq("slug", slug)
      .maybeSingle();

    if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 });
    if (!row?.id) return NextResponse.json({ error: `Unknown feature slug: ${slug}` }, { status: 404 });

    const nextVotes = Number(row.votes ?? 0) + 1;

    const { data: updated, error: updErr } = await sb
      .from("planned_features")
      .update({ votes: nextVotes })
      .eq("id", row.id)
      .select("votes")
      .single();

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, votes: Number(updated?.votes ?? nextVotes) }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
