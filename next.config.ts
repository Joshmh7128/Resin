import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.discogs.com" },
      { protocol: "https", hostname: "**.discogsusercontent.com" },
    ],
  },
};

export default nextConfig;
