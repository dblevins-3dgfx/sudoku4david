// Post-build step: adds a Content-Security-Policy <meta> tag to every page in
// the static export. See src/lib/csp.ts.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { addCsp } from "../src/lib/csp";
import { THEME_SCRIPT } from "../src/lib/theme-script";

const OUT_DIR = "out";

function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith(".html") ? [path] : [];
  });
}

const files = htmlFiles(OUT_DIR);
for (const file of files) {
  writeFileSync(file, addCsp(readFileSync(file, "utf8"), [THEME_SCRIPT]));
}
console.log(`Added a Content-Security-Policy to ${files.length} pages.`);
