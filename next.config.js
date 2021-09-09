module.exports = {
  /**
   * Deploy webapp under a sub-path for clear separation from provider.
   */
  basePath: '/oauth',
  /**
   * Built-in ESLint support.
   *
   * https://nextjs.org/docs/basic-features/eslint
   */
  eslint: {
    ignoreDuringBuilds: true, // disable for this demo repo
  },
};
