import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pas d'export statique : Vercel sert Next.js nativement. Les pages sont
  // pré-rendues au build à partir des JSON de data/.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
