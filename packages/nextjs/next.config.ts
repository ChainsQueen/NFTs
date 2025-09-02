import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: config => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    // Fix libraries that import clsx by hard path to ESM build
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "clsx/dist/clsx.m.js": "clsx",
    };
    config.externals.push("pino-pretty", "lokijs", "encoding");
    // Avoid eval-based devtools in development to satisfy strict CSP
    if (process.env.NODE_ENV === "development") {
      config.devtool = "source-map";
    }
    return config;
  },
  serverExternalPackages: ["ipfs-utils"],
  async redirects() {
    return [
      { source: "/transfers", destination: "/", permanent: false },
      { source: "/ipfsUpload", destination: "/", permanent: false },
      { source: "/ipfsDownload", destination: "/", permanent: false },
      { source: "/debug", destination: "/", permanent: false },
      { source: "/blockexplorer", destination: "/", permanent: false },
    ];
  },
};

const isIpfs = process.env.NEXT_PUBLIC_IPFS_BUILD === "true";

if (isIpfs) {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;
  nextConfig.images = {
    unoptimized: true,
  };
}

// When not exporting for IPFS, allow loading images from common IPFS gateways
if (!isIpfs) {
  nextConfig.images = {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ipfs.io",
      },
      {
        protocol: "https",
        hostname: "cloudflare-ipfs.com",
      },
      {
        protocol: "https",
        hostname: "gateway.pinata.cloud",
      },
      {
        protocol: "https",
        hostname: "nftstorage.link",
      },
      {
        protocol: "https",
        hostname: "dweb.link",
      },
    ],
  };
}

module.exports = nextConfig;
