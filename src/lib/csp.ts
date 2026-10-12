import { createHash } from "node:crypto";
import { MTSUDOKU_ORIGIN } from "./mtsudoku";
import { syncOrigin } from "./remote-config";

// GitHub Pages can't send headers, so the policy goes in a <meta> tag that a
// post-build step adds to each exported page. Next.js writes inline scripts
// (its flight data, and the bootstrap for beforeInteractive scripts) whose
// text is only known after the build, so each one is allowed by its hash.

export function scriptHash(source: string): string {
  return `'sha256-${createHash("sha256").update(source, "utf8").digest("base64")}'`;
}

export function inlineScripts(html: string): string[] {
  const scripts: string[] = [];
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=/i.test(match[1]) || match[2] === "") continue;
    scripts.push(match[2]);
  }
  return scripts;
}

export function contentSecurityPolicy(scripts: readonly string[]): string {
  const hashes = [...new Set(scripts.map(scriptHash))];
  return [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(" ")}`.trim(),
    // React writes style attributes (the progress bar width) into the HTML.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self' ${[MTSUDOKU_ORIGIN, syncOrigin()].filter(Boolean).join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

// `extraScripts` covers inline scripts Next.js creates at runtime, such as the
// theme script, which reaches the page as data rather than as a <script> tag.
export function addCsp(html: string, extraScripts: readonly string[] = []): string {
  if (html.includes('http-equiv="Content-Security-Policy"')) return html;
  const policy = contentSecurityPolicy([...inlineScripts(html), ...extraScripts]);
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}"/>`;
  const updated = html.replace(/<head>/i, `<head>${meta}`);
  if (updated === html) throw new Error("No <head> to add the Content-Security-Policy to");
  return updated;
}
