import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Hide the development indicator (the "N" in the corner) by default.
     Build and runtime errors remain visible; this only hides
     the informational badge. */
  devIndicators: false,
  /* Local dev is accessed via 127.0.0.1 (the API's CORS/cookie host); without
     this, the cross-origin dev-resource guard blocks /_next/hmr and the client
     never hydrates. */
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
