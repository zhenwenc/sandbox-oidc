module.exports = {
  /**
   * Deploy webapp under a sub-path for clear separation from provider.
   */
  basePath: '/oidc',
  rewrites: async () => {
    return {
      fallback: [{ source: '/:path*', destination: `/api/:path*` }],
    };
  },
  /**
   * Built-in ESLint support.
   *
   * https://nextjs.org/docs/basic-features/eslint
   */
  eslint: {
    ignoreDuringBuilds: true, // disable for this demo repo
  },
};
