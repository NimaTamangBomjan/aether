import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every signed-in page is personal and rendered per request, so we use the classic
  // rendering model rather than Cache Components (simpler to reason about; see PROGRESS.md).
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  poweredByHeader: false,
};

export default nextConfig;
