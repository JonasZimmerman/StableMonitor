import type { NextConfig } from "next";

// Get basePath from environment variable (set by GitHub Actions)
// If GITHUB_REPOSITORY is username.github.io, basePath is empty
// Otherwise, basePath is /<repo-name>
const getBasePath = (): string => {
  const repo = process.env.GITHUB_REPOSITORY || "";
  const repoName = repo.split("/")[1] || "";
  const githubUsername = repo.split("/")[0] || "";
  
  // Check if repository name is username.github.io
  if (repoName && repoName === `${githubUsername}.github.io`) {
    return "";
  }
  
  // Otherwise, use /<repo-name> as basePath
  return repoName ? `/${repoName}` : "";
};

const basePath = getBasePath();

const nextConfig: NextConfig = {
  output: process.env.NEXT_EXPORT === "true" ? "export" : undefined,
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  headers() {
    // Required by FHEVM (only works in dev/server mode, not in static export)
    if (process.env.NEXT_EXPORT !== "true") {
      return Promise.resolve([
        {
          source: '/',
          headers: [
            {
              key: 'Cross-Origin-Opener-Policy',
              value: 'same-origin',
            },
            {
              key: 'Cross-Origin-Embedder-Policy',
              value: 'require-corp',
            },
          ],
        },
      ]);
    }
    return Promise.resolve([]);
  }
};

export default nextConfig;

