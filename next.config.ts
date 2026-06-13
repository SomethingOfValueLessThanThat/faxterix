import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Repo obsahuje vlastní lockfile; ukotvíme kořen Turbopacku sem.
  turbopack: {
    root: __dirname,
  },
}

export default nextConfig
