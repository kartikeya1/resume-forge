import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  // Pin the Turbopack workspace root to this project. Without this, Next may
  // infer a parent directory as the root when multiple lockfiles exist, which
  // breaks asset resolution (e.g. the bundled pdf.js worker).
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
