// app/components/CareerChart.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type Plugin,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export type CareerSeasonPoint = {
  season: number;
  war: number | null;
  games: number | null;
  team: string | null;
};

// Canonical mapping: full team name -> ESPN logo abbr (lowercase)
const TEAM_ABBR: Record<string, string> = {
  "Arizona Diamondbacks": "ari",
  "Atlanta Braves": "atl",
  "Baltimore Orioles": "bal",
  "Boston Red Sox": "bos",
  "Chicago Cubs": "chc",
  "Chicago White Sox": "chw",
  "Cincinnati Reds": "cin",
  "Cleveland Guardians": "cle",
  "Colorado Rockies": "col",
  "Detroit Tigers": "det",
  "Houston Astros": "hou",
  "Kansas City Royals": "kc",
  "Los Angeles Angels": "laa",
  "Los Angeles Dodgers": "lad",
  "Miami Marlins": "mia",
  "Milwaukee Brewers": "mil",
  "Minnesota Twins": "min",
  "New York Mets": "nym",
  "New York Yankees": "nyy",
  "Oakland Athletics": "oak",
  "Philadelphia Phillies": "phi",
  "Pittsburgh Pirates": "pit",
  "San Diego Padres": "sd",
  "San Francisco Giants": "sf",
  "Seattle Mariners": "sea",
  "St. Louis Cardinals": "stl",
  "Tampa Bay Rays": "tb",
  "Texas Rangers": "tex",
  "Toronto Blue Jays": "tor",
  "Washington Nationals": "wsh",
};

// Continuity + common historical/variant names -> canonical team name above
const TEAM_ALIASES: Record<string, keyof typeof TEAM_ABBR> = {
  // Franchise renames / continuity
  "Cleveland Indians": "Cleveland Guardians",
  "Tampa Bay Devil Rays": "Tampa Bay Rays",
  "Florida Marlins": "Miami Marlins",
  "Montreal Expos": "Washington Nationals",

  // Common short forms / city-only variants (safe)
  "LA Angels": "Los Angeles Angels",
  "Los Angeles Angels of Anaheim": "Los Angeles Angels",
  "Anaheim Angels": "Los Angeles Angels",
  "Tampa Bay": "Tampa Bay Rays",
  "Cleveland": "Cleveland Guardians",
  "Miami": "Miami Marlins",
  "Washington": "Washington Nationals",

  // Athletics naming variants
  "Oakland A's": "Oakland Athletics",
  "Oakland As": "Oakland Athletics",

  // Rare punctuation/spacing variants that sometimes appear in data exports
  "St Louis Cardinals": "St. Louis Cardinals",
};

function normalizeTeamName(teamName: string) {
  return teamName
    .trim()
    .replace(/\s+/g, " "); // collapse multiple spaces
}

function resolveTeamAbbr(teamName: string | null) {
  if (!teamName) return null;

  const norm = normalizeTeamName(teamName);

  // 1) Direct canonical mapping
  if (TEAM_ABBR[norm]) return TEAM_ABBR[norm];

  // 2) Alias -> canonical -> abbr
  const canonical = TEAM_ALIASES[norm];
  if (canonical && TEAM_ABBR[canonical]) return TEAM_ABBR[canonical];

  return null;
}

function logoUrl(teamName: string | null) {
  const abbr = resolveTeamAbbr(teamName);
  if (!abbr) return null;
  return `https://a.espncdn.com/i/teamlogos/mlb/500/${abbr}.png`;
}

/**
 * Draws scaled team logos at each data point (instead of using pointStyle images,
 * which uses the image's original size and looks terrible).
 */
function makeLogoPlugin(getImages: () => (HTMLImageElement | null)[]): Plugin<"line"> {
  return {
    id: "teamLogoPoints",
    afterDatasetsDraw(chart) {
      const images = getImages();
      if (!images || images.length === 0) return;

      const meta = chart.getDatasetMeta(0);
      if (!meta?.data?.length) return;

      const ctx = chart.ctx;
      ctx.save();

      // Size of logo stamps (px)
      const size = 18;
      const radius = size / 2;

      for (let i = 0; i < meta.data.length; i++) {
        const el: any = meta.data[i];
        const img = images[i];

        if (!el) continue;
        const x = el.x;
        const y = el.y;

        // If we don't have an image for this point, draw a small dot
        if (!img) {
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fillStyle = "rgb(15, 23, 42)";
          ctx.fill();
          ctx.closePath();
          continue;
        }

        // White border circle behind logo
        ctx.beginPath();
        ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.closePath();

        // Clip circle to keep logo round
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        // Draw image centered and scaled
        ctx.drawImage(img, x - radius, y - radius, size, size);

        ctx.restore();

        // subtle outline
        ctx.beginPath();
        ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(15, 23, 42, 0.12)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.closePath();
      }

      ctx.restore();
    },
  };
}

export function CareerChart({
  playerName,
  seasons,
}: {
  playerName: string;
  seasons: CareerSeasonPoint[];
}) {
  const sorted = useMemo(() => {
    return [...(seasons ?? [])]
      .filter((s) => Number.isFinite(s.season))
      .sort((a, b) => a.season - b.season);
  }, [seasons]);

  const labels = useMemo(() => sorted.map((s) => String(s.season)), [sorted]);

  const [images, setImages] = useState<(HTMLImageElement | null)[]>([]);
  const imagesRef = useRef<(HTMLImageElement | null)[]>([]);
  imagesRef.current = images;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const urls = sorted.map((s) => logoUrl(s.team));
      const next: (HTMLImageElement | null)[] = new Array(urls.length).fill(null);

      await Promise.all(
        urls.map(
          (u, idx) =>
            new Promise<void>((resolve) => {
              if (!u) {
                resolve();
                return;
              }
              const img = new Image();
              img.crossOrigin = "anonymous";
              img.onload = () => {
                next[idx] = img;
                resolve();
              };
              img.onerror = () => {
                next[idx] = null;
                resolve();
              };
              img.src = u;
            })
        )
      );

      if (!cancelled) setImages(next);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [sorted]);

  if (!sorted || sorted.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-sm text-slate-500">No chart data available.</div>
      </div>
    );
  }

  const warValues = sorted.map((s) => (s.war == null ? null : Number(s.war)));

  const chartData = {
    labels,
    datasets: [
      {
        label: "WAR",
        data: warValues,
        borderColor: "rgb(15, 23, 42)",
        backgroundColor: "rgba(15, 23, 42, 0.06)",
        tension: 0, // ✅ straight lines
        fill: true, // keep light fill, looks good with minimal style
        borderWidth: 2,
        // Keep default points tiny; logos are drawn by plugin
        pointRadius: 2,
        pointHoverRadius: 4,
        pointBackgroundColor: "rgba(15, 23, 42, 0.7)",
        pointBorderColor: "#fff",
        pointBorderWidth: 1,
      },
    ],
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 900 },
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: `${playerName} — WAR by Season`,
        font: { size: 16, weight: "bold" },
        color: "#0f172a",
        padding: 16,
      },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        padding: 12,
        titleFont: { size: 13, weight: "bold" },
        bodyFont: { size: 12 },
        callbacks: {
          title: (ctx: any) => {
            const i = ctx?.[0]?.dataIndex ?? 0;
            return `${sorted[i]?.season ?? ""} Season`;
          },
          label: (ctx: any) => {
            const i = ctx.dataIndex;
            const s = sorted[i];
            const war = s?.war == null ? "—" : Number(s.war).toFixed(2);
            const games = s?.games == null ? "—" : s.games;
            const team = s?.team ?? "—";
            return [`WAR: ${war}`, `Games: ${games}`, `Team: ${team}`];
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "#64748b", font: { size: 11 } },
      },
      y: {
        beginAtZero: false,
        grid: { color: "rgba(15, 23, 42, 0.06)" },
        ticks: { color: "#64748b", font: { size: 11 } },
        title: {
          display: true,
          text: "WAR",
          color: "#334155",
          font: { size: 12, weight: "bold" },
        },
      },
    },
  };

  const logoPlugin = useMemo(() => makeLogoPlugin(() => imagesRef.current), []);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="p-4 sm:p-6">
        <div style={{ height: 320 }}>
          <Line data={chartData as any} options={options} plugins={[logoPlugin]} />
        </div>
        <div className="mt-3 text-xs text-slate-500">
          Logos indicate team (per season when available; otherwise current team).
        </div>
      </div>
    </div>
  );
}
