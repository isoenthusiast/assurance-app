import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Railway needs standalone output for deployment
  output: "standalone",
  // pg is a native module — must be externalized for standalone builds
  serverExternalPackages: ["pg"],
};

export default nextConfig;
