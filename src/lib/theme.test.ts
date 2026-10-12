import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME, THEMES } from "../themes";
import { findTheme, themeCss, themeScript } from "./theme";

type Result = { theme?: string; dark: boolean };

// Runs the pre-hydration script against a stand-in document.
function runScript(saved: string | null, prefersDark = false, storageThrows = false): Result {
  const result: Result = { dark: false };
  const documentElement = {
    dataset: result as { theme?: string },
    classList: { add: (name: string) => (result.dark = name === "dark") },
  };
  const localStorage = {
    getItem: () => {
      if (storageThrows) throw new Error("blocked");
      return saved;
    },
  };
  const matchMedia = () => ({ matches: prefersDark });
  new Function("document", "localStorage", "matchMedia", themeScript())(
    { documentElement },
    localStorage,
    matchMedia,
  );
  return result;
}

describe("themes", () => {
  it("have unique, safe ids and names", () => {
    const ids = THEMES.map((theme) => theme.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(new Set(THEMES.map((theme) => theme.name)).size, THEMES.length);
    for (const id of ids) assert.match(id, /^[a-z][a-z-]*$/);
  });

  it("only hold values that stay inside their CSS declaration", () => {
    for (const theme of THEMES) {
      for (const value of [...Object.values(theme.colors), theme.backdrop]) {
        assert.doesNotMatch(value, /[{};<>]/, `${theme.id}: ${value}`);
      }
    }
  });

  it("default to a light and a dark theme that exist", () => {
    assert.equal(findTheme(DEFAULT_LIGHT_THEME)?.scheme, "light");
    assert.equal(findTheme(DEFAULT_DARK_THEME)?.scheme, "dark");
  });

  it("each get a block in the stylesheet", () => {
    const css = themeCss();
    assert.ok(css.startsWith(":root{"));
    for (const theme of THEMES) {
      assert.ok(css.includes(`:root[data-theme="${theme.id}"]{--background:${theme.colors.background};`));
      assert.ok(css.includes(`color-scheme:${theme.scheme}}`));
    }
  });
});

describe("theme script", () => {
  it("restores a saved theme", () => {
    for (const theme of THEMES) {
      assert.deepEqual(runScript(theme.id), { theme: theme.id, dark: theme.scheme === "dark" });
    }
  });

  it("maps the old light and dark values to the defaults", () => {
    assert.deepEqual(runScript("light", true), { theme: DEFAULT_LIGHT_THEME, dark: false });
    assert.deepEqual(runScript("dark"), { theme: DEFAULT_DARK_THEME, dark: true });
  });

  it("follows the system setting when nothing usable is saved", () => {
    assert.deepEqual(runScript(null), { theme: DEFAULT_LIGHT_THEME, dark: false });
    assert.deepEqual(runScript("retired-theme", true), { theme: DEFAULT_DARK_THEME, dark: true });
  });

  it("leaves the page alone when storage is blocked", () => {
    assert.deepEqual(runScript(null, true, true), { dark: false });
  });
});
