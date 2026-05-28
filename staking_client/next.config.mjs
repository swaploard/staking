/**
 * @type {import('next').NextConfig}
 *
 * Production-grade Next.js configuration
 * Optimized for:
 * - performance
 * - security
 * - observability
 * - deployment stability
 * - CI/CD friendliness
 */

const isProd = process.env.NODE_ENV === "production"

const nextConfig = {
  output: "standalone",

  /**
   * React strict mode helps detect unsafe lifecycle usage,
   * accidental side effects, and deprecated APIs.
   *
   * Enabled in production-grade apps because it catches
   * issues early during development.
   */
  reactStrictMode: true,

  /**
   * Production apps should NEVER ignore TypeScript errors.
   *
   * Ignoring build errors can deploy broken code to production,
   * causing runtime crashes and hard-to-debug issues.
   */
  typescript: {
    ignoreBuildErrors: false,
  },

  /**
   * Enable compression for smaller response payloads.
   *
   * Reduces bandwidth usage and improves page load speed.
   */
  compress: true,

  /**
   * Removes the "X-Powered-By: Next.js" header.
   *
   * Small security improvement by reducing framework fingerprinting.
   */
  poweredByHeader: false,

  /**
   * Generates ETags for caching validation.
   *
   * Helps browsers/CDNs determine whether content changed.
   */
  generateEtags: true,

  /**
   * Production source maps:
   *
   * Useful for debugging production errors with tools like:
   * - Sentry
   * - Datadog
   * - New Relic
   *
   * Disable if bundle source exposure is a concern.
   */
  productionBrowserSourceMaps: false,

  /**
   * Image optimization configuration.
   */
  images: {
    /**
     * DO NOT use unoptimized: true in production
     * unless you are exporting static HTML or using a CDN manually.
     *
     * Next.js image optimization provides:
     * - lazy loading
     * - resizing
     * - modern formats (WebP/AVIF)
     * - bandwidth savings
     */
    unoptimized: false,

    /**
     * Modern image formats for better compression.
     */
    formats: ["image/avif", "image/webp"],

    /**
     * Remote image domains whitelist.
     *
     * Prevents malicious external image usage.
     * Add your CDN or asset domains here.
     */
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "cdn.yourdomain.com",
      },
    ],
  },

  /**
   * Experimental optimizations.
   *
   * Useful for large applications and monorepos.
   */
  experimental: {
    /**
     * Optimizes package imports automatically.
     *
     * Reduces bundle size significantly for large libraries.
     */
    optimizePackageImports: [
      "lucide-react",
      "@mui/material",
      "lodash-es",
    ],
  },

  /**
   * Environment variables exposed to browser.
   *
   * NEVER expose secrets here.
   * Only public-safe variables should use NEXT_PUBLIC_ prefix.
   */
  env: {
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  },

  /**
   * HTTP security headers.
   *
   * Adds important browser-level protections.
   */
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          /**
           * Prevents clickjacking attacks.
           */
          {
            key: "X-Frame-Options",
            value: "DENY",
          },

          /**
           * Prevents MIME-type sniffing.
           */
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },

          /**
           * Enables browser XSS filtering.
           */
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },

          /**
           * Controls referrer information sent by browser.
           */
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },

          /**
           * Forces HTTPS connections.
           *
           * Only enable in production with HTTPS configured.
           */
          ...(isProd
            ? [
              {
                key: "Strict-Transport-Security",
                value:
                  "max-age=63072000; includeSubDomains; preload",
              },
            ]
            : []),
        ],
      },
    ]
  },

  /**
   * Redirects configuration.
   *
   * Useful for:
   * - legacy routes
   * - SEO migration
   * - API version migration
   */
  async redirects() {
    return []
  },

  /**
   * Rewrite rules.
   *
   * Useful for:
   * - API gateway patterns
   * - reverse proxy setups
   * - microservices architecture
   */
  async rewrites() {
    return []
  },
}

export default nextConfig