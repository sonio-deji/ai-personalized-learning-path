import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  output: "standalone",
  // The monorepo root, so the standalone build picks up hoisted node_modules.
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default config;
