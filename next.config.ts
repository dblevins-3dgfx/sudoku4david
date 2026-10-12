import type { NextConfig } from "next";

// GitHub project pages are served from /<repo>. configure-pages sets BASE_PATH
// in Actions. A local build leaves it empty and serves from the site root.
const basePath = process.env.BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  // The dev server only allows localhost by default. Opening it at 127.0.0.1
  // needs an entry here, or the page never leaves the server-rendered shell.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
