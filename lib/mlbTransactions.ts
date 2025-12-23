// lib/mlbTransactions.ts

export type LatestTransferItem = {
  id: string;
  date: string; // API date string
  personId?: number | null; // MLB person id (for headshots)
  playerName: string;
  type: string;
  fromTeam?: string | null;
  toTeam?: string | null;
  description?: string | null;
};

function str(v: any, fallback = "") {
  const s = String(v ?? "").trim();
  return s ? s : fallback;
}

function isoDate(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function getLatestTransfers(limit = 5): Promise<LatestTransferItem[]> {
  const end = new Date();
  const start = new Date(end.getTime() - 21 * 24 * 60 * 60 * 1000);

  const startDate = isoDate(start);
  const endDate = isoDate(end);

  const url = `https://statsapi.mlb.com/api/v1/transactions?startDate=${startDate}&endDate=${endDate}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];

  const json = await res.json();
  const rows = Array.isArray(json?.transactions) ? json.transactions : [];
  if (!rows.length) return [];

  const out: LatestTransferItem[] = [];

  for (const r of rows) {
    const playerName = str(r?.person?.fullName, "");
    const personIdRaw = r?.person?.id;
    const personId = personIdRaw == null ? null : Number(personIdRaw);

    const type = str(r?.typeDesc, str(r?.typeCode, "Transaction"));
    const date = str(r?.date, str(r?.effectiveDate, ""));

    const fromTeam =
      r?.fromTeam?.name != null
        ? str(r.fromTeam.name, "")
        : r?.fromTeam?.abbreviation != null
          ? str(r.fromTeam.abbreviation, "")
          : null;

    const toTeam =
      r?.toTeam?.name != null
        ? str(r.toTeam.name, "")
        : r?.toTeam?.abbreviation != null
          ? str(r.toTeam.abbreviation, "")
          : null;

    const description = r?.description != null ? str(r.description, "") : null;

    const id =
      str(r?.transactionId, "") ||
      `${playerName}|${type}|${date}|${fromTeam ?? ""}|${toTeam ?? ""}`;

    if (!playerName) continue;

    out.push({
      id,
      date: date || "",
      personId: Number.isFinite(personId) ? personId : null,
      playerName,
      type,
      fromTeam: fromTeam || null,
      toTeam: toTeam || null,
      description: description || null,
    });
  }

  // newest first
  out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  // de-dupe
  const seen = new Set<string>();
  const deduped: LatestTransferItem[] = [];
  for (const x of out) {
    if (seen.has(x.id)) continue;
    seen.add(x.id);
    deduped.push(x);
    if (deduped.length >= limit) break;
  }

  return deduped;
}
