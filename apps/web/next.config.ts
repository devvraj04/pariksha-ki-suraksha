import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    'neet-1.portal.localhost',
    '*.portal.localhost',
    'admin.localhost',
    'national-testing-agency.localhost',
    'leakguard.localhost'
  ],
};

export default nextConfig;
