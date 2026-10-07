import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Optional alternate build dir (e.g. for a side-by-side test build); defaults to .next.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // @elitr/shared is consumed for types only, but transpile it in case a value import slips in.
  transpilePackages: ["@elitr/shared"],
  // Don't let `next dev` write AGENTS.md / CLAUDE.md into the app; the repo root AGENTS.md is canonical.
  agentRules: false,
  devIndicators: false,
};

export default nextConfig;
