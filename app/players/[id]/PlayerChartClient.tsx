// app/players/[id]/PlayerChartClient.tsx
"use client";

import { useEffect, useState } from "react";
import { CareerChart, type CareerSeasonPoint } from "@/app/components/CareerChart";

export default function PlayerChartClient({
  playerName,
  seasons,
}: {
  playerName: string;
  seasons: CareerSeasonPoint[];
}) {
  // Mount gate so the chart appears AFTER page load (your “impact” request)
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 120);
    return () => window.clearTimeout(t);
  }, []);

  if (!mounted) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-sm text-slate-500">Loading chart…</div>
      </div>
    );
  }

  return <CareerChart playerName={playerName} seasons={seasons} />;
}
