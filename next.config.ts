import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native/WASM database drivers must not be bundled.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  experimental: {
    // CV uploads go through a server action; the default limit is 1 MB.
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
