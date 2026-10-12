"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { applyTheme } from "@/lib/theme";
import { DEFAULT_LIGHT_THEME, THEMES } from "@/themes";

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

export function ThemePicker() {
  const current = useThemeId();
  return (
    <div role="group" aria-label="Color theme" className="mt-4">
      <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">Theme</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {THEMES.map((theme) => (
          <Button
            key={theme.id}
            type="button"
            variant={current === theme.id ? "default" : "outline"}
            className="h-11 justify-start gap-2 px-2.5"
            aria-pressed={current === theme.id}
            onClick={() => applyTheme(theme)}
          >
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
            <span className="truncate">{theme.name}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
