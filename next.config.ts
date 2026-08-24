import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns", "date-fns-tz"],
  },
  async redirects() {
    return [
      {
        source: "/book/cancel/:token",
        destination: "/agendar/cancel/:token",
        permanent: true,
      },
      {
        source: "/book/:businessSlug",
        destination: "/agendar/:businessSlug",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
