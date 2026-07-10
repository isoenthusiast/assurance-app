import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Railway needs standalone output for deployment
  output: "standalone",
  // pg is a native module — must be externalized for standalone builds.
  // pdfjs-dist, @napi-rs/canvas, tesseract.js have native/WASM/worker
  // dependencies that must not be bundled.
  serverExternalPackages: ["pg", "pdfjs-dist", "@napi-rs/canvas", "tesseract.js"],
};

export default nextConfig;
