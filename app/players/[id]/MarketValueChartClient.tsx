// app/players/[id]/MarketValueChartClient.tsx
"use client";

import { useEffect, useState } from "react";
import { MarketValueChart, type MarketValuePoint } from "@/app/components/MarketValueChart";

export default function MarketValueChartClient({
  playerName,
  points,
}: {
  playerName: string;
  points: MarketValuePoint[];
}) {
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

  return <MarketValueChart playerName={playerName} points={points} />;
}
