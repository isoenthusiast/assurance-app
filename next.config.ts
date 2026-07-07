import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Railway needs standalone output for deployment
  output: "standalone",
  // better-sqlite3 is a native module — must be externalized for build
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
