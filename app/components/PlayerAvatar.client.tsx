// app/components/PlayerAvatar.client.tsx
"use client";

import { useMemo, useState } from "react";

type Props = {
  alt: string;
  className?: string;     // applied to the <img>
  wrapperClassName?: string; // applied to wrapper div (useful if you want sizing here)
  candidates: Array<string | null | undefined>; // ordered best -> worst
};

function initialsFromName(name: string) {
  const parts = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function PlayerAvatar({
  alt,
  candidates,
  className,
  wrapperClassName,
}: Props) {
  const list = useMemo(
    () => candidates.map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean),
    [candidates]
  );

  const [idx, setIdx] = useState(0);

  const src = list[idx] ?? "";

  // If we have no viable src, or all have failed, show initials.
  const showInitials = !src || idx >= list.length;

  if (showInitials) {
    return (
      <div
        aria-label={alt}
        title={alt}
        className={
          wrapperClassName ??
          "h-full w-full flex items-center justify-center rounded-full bg-slate-100 text-slate-700 border border-slate-200"
        }
      >
        <span className="text-xs font-bold tracking-tight">
          {initialsFromName(alt)}
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setIdx((v) => v + 1)}
    />
  );
}
