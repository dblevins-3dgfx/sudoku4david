import type { NextConfig } from "next";

// GitHub project pages are served from /<repo>. configure-pages sets BASE_PATH
// in Actions. A local build leaves it empty and serves from the site root.
const basePath = process.env.BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  // The preview link is a different host than this dev server. Next.js
  // refuses its dev socket unless the host is listed here, and without that
  // socket the page never leaves the server-rendered shell.
  allowedDevOrigins: ["127.0.0.1", "*.agent.cvm.dev"],
};

export default nextConfig;
