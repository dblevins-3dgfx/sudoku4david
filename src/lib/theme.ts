import { DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME, THEMES, type Theme } from "../themes";
import { THEME_STORAGE_KEY } from "./storage";

// Themes are plain data in src/themes. This turns them into the stylesheet and
// the pre-hydration script, so nothing here changes when a theme is added.

export function findTheme(id: string | null | undefined, themes: readonly Theme[] = THEMES) {
  return themes.find((theme) => theme.id === id);
}

function block(selector: string, theme: Theme): string {
  const vars = Object.entries(theme.colors).map(([name, value]) => `--${name}:${value}`);
  return [
    `${selector}{${[...vars, `color-scheme:${theme.scheme}`].join(";")}}`,
    `${selector} body{background-image:${theme.backdrop}}`,
  ].join("\n");
}

// :root carries the light default, for when the script can't run (storage
// blocked). Each theme then overrides it through data-theme on <html>.
export function themeCss(themes: readonly Theme[] = THEMES, fallback = DEFAULT_LIGHT_THEME): string {
  const base = findTheme(fallback, themes) ?? themes[0];
  return [block(":root", base), ...themes.map((theme) => block(`:root[data-theme="${theme.id}"]`, theme))].join("\n");
}

// Runs before hydration so the saved theme shows on the first paint. Before
// there were named themes the saved value was "light" or "dark", so those map
// to the defaults. The Content-Security-Policy allows the script by its hash,
// which the build computes, so it must not depend on anything at runtime.
export function themeScript(
  themes: readonly Theme[] = THEMES,
  defaults = { light: DEFAULT_LIGHT_THEME, dark: DEFAULT_DARK_THEME },
  storageKey = THEME_STORAGE_KEY,
): string {
  const config = {
    k: storageKey,
    i: themes.map((theme) => theme.id),
    d: themes.filter((theme) => theme.scheme === "dark").map((theme) => theme.id),
    l: defaults.light,
    n: defaults.dark,
  };
  return `try{var c=${JSON.stringify(config)},h=document.documentElement,t=localStorage.getItem(c.k);if(t==="light")t=c.l;else if(t==="dark")t=c.n;if(c.i.indexOf(t)<0)t=matchMedia("(prefers-color-scheme: dark)").matches?c.n:c.l;h.dataset.theme=t;if(c.d.indexOf(t)>=0)h.classList.add("dark")}catch(e){}`;
}

export const THEME_CSS = themeCss();
export const THEME_SCRIPT = themeScript();

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme.id;
  root.classList.toggle("dark", theme.scheme === "dark");
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme.id);
  } catch {
    // Storage can be unavailable in private browsing.
  }
}
