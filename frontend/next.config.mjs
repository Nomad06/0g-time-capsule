/** @type {import('next').NextConfig} */
const config = {
  webpack(cfg, { isServer }) {
    cfg.resolve.fallback = {
      ...cfg.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
    };

    // tlock-js ships only an ESM "module" field — tell webpack to resolve it
    cfg.resolve.mainFields = isServer
      ? ["main", "module"]
      : ["browser", "module", "main"];

    return cfg;
  },
  // Transpile ESM-only packages
  transpilePackages: ["tlock-js"],
};

export default config;
