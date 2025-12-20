// app/components/BrowsePlayersPanel.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type BrowseRow = {
  id: number;
  name: string;
  team: string | null;
  position: string | null;
  age: number | null;
  image_url: string | null;
  war: number | null;
  season: number | null;
};

function fmt(n: number | null | undefined, d = 2) {
  if (n === null || n === undefined) return "—";
  return n.toFixed(d);
}

function getPageItems(current: number, total: number) {
  const items: (number | "...")[] = [];
  if (total <= 12) {
    for (let i = 1; i <= total; i++) items.push(i);
    return items;
  }

  const c = Math.max(1, Math.min(total, current));
  const pushRange = (a: number, b: number) => {
    for (let i = a; i <= b; i++) items.push(i);
  };

  if (c <= 6) {
    pushRange(1, 10);
    items.push("...");
    items.push(total);
    return items;
  }

  if (c >= total - 5) {
    items.push(1);
    items.push("...");
    pushRange(total - 9, total);
    return items;
  }

  items.push(1);
  items.push("...");
  pushRange(c - 2, c + 2);
  items.push("...");
  items.push(total);
  return items;
}

export function BrowsePlayersPanel({
  initialQ,
  initialPage,
  pageSize,
  initialRows,
  initialTotal,
}: {
  initialQ: string;
  initialPage: number;
  pageSize: number;
  initialRows: BrowseRow[];
  initialTotal: number;
}) {
  const [q, setQ] = useState(initialQ);
  const [page, setPage] = useState(initialPage);
  const [rows, setRows] = useState<BrowseRow[]>(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil((total || 0) / pageSize)), [total, pageSize]);

  const abortRef = useRef<AbortController | null>(null);

  const buildUrl = (nextQ: string, nextPage: number) => {
    const sp = new URLSearchParams();
    if (nextQ.trim()) sp.set("q", nextQ.trim());
    sp.set("bp", String(nextPage));
    sp.set("bps", String(pageSize));
    return `/?${sp.toString()}#browse`;
  };

  const buildApi = (nextQ: string, nextPage: number) => {
    const sp = new URLSearchParams();
    if (nextQ.trim()) sp.set("q", nextQ.trim());
    sp.set("bp", String(nextPage));
    sp.set("bps", String(pageSize));
    return `/api/browse-players?${sp.toString()}`;
  };

  const pushUrlNoNav = (url: string) => {
    window.history.pushState({}, "", url);
  };

  const load = async (nextQ: string, nextPage: number, pushUrl: boolean) => {
    setErr(null);
    setLoading(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const apiUrl = buildApi(nextQ, nextPage);
      const res = await fetch(apiUrl, { method: "GET", signal: controller.signal });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`browse fetch failed: ${res.status}${text ? ` (${text})` : ""}`);
      }

      const json = await res.json();
      setRows(json.rows ?? []);
      setTotal(json.total ?? 0);
      setQ(nextQ);
      setPage(nextPage);

      if (pushUrl) {
        pushUrlNoNav(buildUrl(nextQ, nextPage));
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setErr(e?.message ?? "browse fetch failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const onPop = () => {
      const url = new URL(window.location.href);
      const nextQ = (url.searchParams.get("q") ?? "").trim();
      const nextPage = Math.max(1, Number(url.searchParams.get("bp") ?? "1") || 1);
      load(nextQ, nextPage, false);
    };

    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = useMemo(() => getPageItems(page, totalPages), [page, totalPages]);

  const Pager = () => {
    const hasPrev = page > 1;
    const hasNext = page < totalPages;

    return (
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!hasPrev || loading}
            onClick={() => load(q, page - 1, true)}
            className={`inline-flex items-center justify-center rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm ${
              hasPrev && !loading
                ? "border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                : "border-slate-200 bg-slate-50 text-slate-400"
            }`}
          >
            Prev
          </button>
          <button
            type="button"
            disabled={!hasNext || loading}
            onClick={() => load(q, page + 1, true)}
            className={`inline-flex items-center justify-center rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm ${
              hasNext && !loading
                ? "border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                : "border-slate-200 bg-slate-50 text-slate-400"
            }`}
          >
            Next
          </button>
        </div>

        <div className="flex items-center gap-1">
          {items.map((it, i) => {
            if (it === "...") {
              return (
                <span key={`dots-${i}`} className="px-1 text-xs text-slate-400">
                  …
                </span>
              );
            }

            const isActive = it === page;
            return (
              <button
                key={it}
                type="button"
                disabled={loading}
                onClick={() => load(q, it, true)}
                className={`min-w-8 rounded-lg border px-2 py-2 text-center text-xs font-semibold shadow-sm ${
                  isActive ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                }`}
              >
                {it}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Controls */}
      <div className="border-b border-slate-200 px-6 py-4">
        <div className="flex items-start justify-between gap-4 flex-col sm:flex-row">
          <div>
            <div className="text-sm font-semibold text-slate-900">Browse Players</div>
            <div className="mt-1 text-xs text-slate-500">Search any player and open a profile for full context.</div>
          </div>

          <form
            className="flex gap-2 w-full sm:w-auto"
            onSubmit={(e) => {
              e.preventDefault();
              load(q, 1, true);
              // jump to panel
              document.getElementById("browse")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search players..."
              className="w-full sm:w-72 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-slate-300"
            />
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 shadow-sm"
              disabled={loading}
            >
              Search
            </button>
          </form>
        </div>
      </div>

      {/* Top pager */}
      <div className="border-b border-slate-200 px-6 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-500">
            Page <span className="font-semibold text-slate-700">{page}</span> of{" "}
            <span className="font-semibold text-slate-700">{totalPages}</span>
            {total ? ` · ${total.toLocaleString()} players` : ""}
          </div>
          <Pager />
        </div>
      </div>

      {/* Errors / Loading */}
      {err ? <div className="px-6 py-4 text-sm text-rose-700">{err}</div> : null}
      {loading ? <div className="px-6 py-4 text-sm text-slate-500">Loading…</div> : null}

      {/* List */}
      <div className="divide-y divide-slate-200">
        {rows.map((p) => (
          <div key={p.id} className="px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <Link href={`/players/${p.id}`} className="min-w-0 flex items-center gap-3">
                {/* Headshot */}
                <div className="h-10 w-10 rounded-full border border-slate-200 bg-slate-50 overflow-hidden shrink-0">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                  ) : null}
                </div>

                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 truncate">{p.name}</div>
                  <div className="mt-1 text-xs text-slate-500 truncate">
                    {(p.team ?? "Unknown")} · {(p.position ?? "—")} {p.age ? `· Age ${p.age}` : ""}
                    {p.season ? ` · WAR (${p.season}): ${fmt(p.war, 2)}` : ""}
                  </div>
                </div>
              </Link>

              <div className="flex items-center gap-3">
                <Link
                  href={`/compare?add=${p.id}`}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-800 whitespace-nowrap"
                  title="Add to Compare"
                >
                  Compare +
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom pager */}
      <div className="border-t border-slate-200 px-6 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-500">
            Page <span className="font-semibold text-slate-700">{page}</span> of{" "}
            <span className="font-semibold text-slate-700">{totalPages}</span>
            {total ? ` · ${total.toLocaleString()} players` : ""}
          </div>
          <Pager />
        </div>
      </div>
    </>
  );
}
