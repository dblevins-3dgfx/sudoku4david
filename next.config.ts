import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The preview link is a different host than this dev server. Next.js
  // refuses its dev socket unless the host is listed here, and without that
  // socket the page never leaves the server-rendered shell.
  allowedDevOrigins: ["127.0.0.1", "*.agent.cvm.dev"],
};

export default nextConfig;
