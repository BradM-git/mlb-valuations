// app/components/MarketValueChart.tsx
"use client";

import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

export type MarketValuePoint = {
  label: string; // e.g. "2022", "2024-06", etc.
  value: number | null; // USD
};

function formatMoneyShort(n: number) {
  // Compact USD like $395.9M / $12.4M / $950K
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function MarketValueChart({
  playerName,
  points,
}: {
  playerName: string;
  points: MarketValuePoint[];
}) {
  const sorted = useMemo(() => {
    const cleaned = (points ?? []).filter((p) => p && typeof p.label === "string");
    return cleaned;
  }, [points]);

  const labels = useMemo(() => sorted.map((p) => p.label), [sorted]);

  const values = useMemo(() => sorted.map((p) => (typeof p.value === "number" ? p.value : null)), [sorted]);

  const hasAny = useMemo(() => values.some((v) => typeof v === "number" && Number.isFinite(v)), [values]);

  if (!sorted.length || !hasAny) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-sm text-slate-500">No market value history available.</div>
      </div>
    );
  }

  const data = {
    labels,
    datasets: [
      {
        label: "Market Value",
        data: values,
        tension: 0.25,
        fill: true,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
      },
    ],
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title(items: any) {
            const it = items?.[0];
            return it?.label ?? "";
          },
          label(ctx: any) {
            const v = ctx?.parsed?.y;
            if (typeof v !== "number" || !Number.isFinite(v)) return "—";
            return formatMoneyShort(v);
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { maxRotation: 0, autoSkip: true },
      },
      y: {
        grid: { color: "rgba(15,23,42,0.08)" },
        ticks: {
          callback(value: any) {
            const n = Number(value);
            if (!Number.isFinite(n)) return "";
            return formatMoneyShort(n);
          },
        },
      },
    },
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div className="text-sm font-semibold text-slate-900">Market Value History</div>
        <div className="text-xs text-slate-500 truncate">{playerName}</div>
      </div>

      <div className="text-xs text-slate-500 mb-4">
        Historical market value from your DB (not projections).
      </div>

      <div className="h-[260px]">
        <Line data={data} options={options} />
      </div>
    </div>
  );
}
