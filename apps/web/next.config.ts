import type { NextConfig } from "next";

const KC_ORIGIN = process.env.KICKOFF_CLASH_URL ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/kickoff-clash",
        destination: `${KC_ORIGIN}/`,
      },
      {
        source: "/kickoff-clash/:path*",
        destination: `${KC_ORIGIN}/:path*`,
      },
    ];
  },
};

export default nextConfig;
