"use client";

import dynamic from "next/dynamic";

export const BrowsePlayersPanelClient = dynamic(
  () => import("./BrowsePlayersPanel").then((m) => m.BrowsePlayersPanel),
  { ssr: false }
);
