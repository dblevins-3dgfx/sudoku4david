import type { MetadataRoute } from "next";

// The web app manifest: a small JSON file that tells a phone how to run the
// site once it is added to the home screen (its name, icon, and that it opens
// full screen without Safari's address bar). Next turns this function into
// /manifest.webmanifest at build time and links it from every page.
//
// GitHub Pages serves the site under /<repo>, so the start page carries the
// same BASE_PATH as next.config.ts.
const basePath = process.env.BASE_PATH || "";

// Required for `output: "export"`: build this file once, at build time.
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "David's own private Sudoku",
    short_name: "Sudoku",
    start_url: `${basePath}/`,
    scope: `${basePath}/`,
    display: "standalone",
    background_color: "#f6f1e7",
    theme_color: "#f6f1e7",
    icons: [{ src: `${basePath}/apple-icon.png`, sizes: "180x180", type: "image/png" }],
  };
}
