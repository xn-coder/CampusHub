import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    // Add alias for pdfjs-dist
    config.resolve.alias['pdfjs-dist'] = 'pdfjs-dist/build/pdf';
    return config;
  },
};

export default nextConfig;
