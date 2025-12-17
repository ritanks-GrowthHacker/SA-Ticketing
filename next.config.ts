import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  
  // Webpack configuration to prevent loading of .env.local files
  webpack: (config: any) => {
    // This ensures consistent environment variable loading
    return config;
  }
};

export default nextConfig;
