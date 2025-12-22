// app/components/mlb/TabsClient.tsx
"use client";

import React, { createContext, useContext, useMemo, useState } from "react";

export type TabDef = {
  key: string;
  label: string;
};

type TabsCtx = {
  activeKey: string;
  setActiveKey: (k: string) => void;
};

const TabsContext = createContext<TabsCtx | null>(null);

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function TabsClient({
  tabs,
  initialKey,
  children,
}: {
  tabs: TabDef[];
  initialKey?: string;
  children?: React.ReactNode;
}) {
  const firstKey = tabs?.[0]?.key ?? "tab";
  const safeInitial = initialKey && tabs.some((t) => t.key === initialKey) ? initialKey : firstKey;

  const [activeKey, setActiveKey] = useState<string>(safeInitial);

  const ctx = useMemo(() => ({ activeKey, setActiveKey }), [activeKey]);

  return (
    <TabsContext.Provider value={ctx}>
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((t) => {
          const active = t.key === activeKey;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveKey(t.key)}
              className={cx(
                "inline-flex items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm",
                active
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              )}
              aria-pressed={active}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Important: content is rendered by TabPanel below */}
      {children ? <div className="mt-4">{children}</div> : null}
    </TabsContext.Provider>
  );
}

export function TabPanel({
  tabKey,
  children,
  className,
}: {
  tabKey: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = useContext(TabsContext);

  // If someone renders TabPanel without TabsClient above it, degrade gracefully:
  const activeKey = ctx?.activeKey ?? tabKey;

  const isActive = activeKey === tabKey;

  return (
    <div
      className={className}
      hidden={!isActive}
      aria-hidden={!isActive}
      data-tab-panel={tabKey}
    >
      {children}
    </div>
  );
}
