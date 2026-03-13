/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    instrumentationHook: true,
    serverActions: {
      bodySizeLimit: '2mb',
    },
    serverComponentsExternalPackages: ['sql.js', 'cheerio'],
  },
}

module.exports = nextConfig
