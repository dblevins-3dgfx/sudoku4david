"use client";

import { useSyncExternalStore } from "react";
import { applyTheme } from "@/lib/theme";
import { DEFAULT_LIGHT_THEME, THEMES } from "@/themes";
import type { Theme } from "@/themes/theme";
import { PrefSelect, type PrefOption } from "./pref-select";

// The theme lives on <html data-theme>, set before hydration, so the picker
// reads it from there instead of keeping a copy in React state.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function useThemeId(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset.theme ?? DEFAULT_LIGHT_THEME,
    () => null,
  );
}

function Swatch({ theme }: { theme: Theme }) {
  return (
    <span
      aria-hidden
      className="flex size-6 shrink-0 items-center justify-center rounded-sm border-2 font-heading text-sm"
      style={{
        background: theme.colors.board,
        borderColor: theme.colors["board-line"],
        color: theme.colors["cell-user"],
      }}
    >
      7
    </span>
  );
}

const THEME_OPTIONS: PrefOption<string>[] = THEMES.map((theme) => ({
  value: theme.id,
  label: theme.name,
  swatch: <Swatch theme={theme} />,
}));

export function ThemePicker() {
  const current = useThemeId() ?? DEFAULT_LIGHT_THEME;
  return (
    <PrefSelect
      label="Theme"
      value={current}
      options={THEME_OPTIONS}
      onChange={(id) => {
        const theme = THEMES.find((t) => t.id === id);
        if (theme) applyTheme(theme);
      }}
    />
  );
}
