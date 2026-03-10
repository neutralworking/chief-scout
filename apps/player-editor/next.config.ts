import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/chief-scout",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
