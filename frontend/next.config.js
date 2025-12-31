/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    domains: [
      's3.amazonaws.com',
      'bloxgrid-images.s3.amazonaws.com',
      'bloxgrid-images.s3.us-east-1.amazonaws.com',
    ],
  },
}

module.exports = nextConfig
