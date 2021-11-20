import * as t from 'io-ts';
import Chance from 'chance';
import { URLSearchParams } from 'url';
import { errors, Provider, KoaContextWithOIDC, InteractionResults, AdapterFactory } from 'oidc-provider';

import { Logger } from '@navch/common';
import { instanceOf } from '@navch/codec';
import { makeHandler, makeHandlers, middlewares } from '@navch/express';

import { routes } from '../constants';

export type OIDCProviderOptions = {
  readonly publicURL: string;
  readonly adapter: AdapterFactory | undefined;
};

export type ProviderContext = {
  readonly logger: Logger;
  readonly publicURL: string;
};

export const buildProvider = (options: ProviderContext & OIDCProviderOptions): Provider => {
  const provider = new Provider(options.publicURL, {
    adapter: options.adapter,
    clients: [
      {
        client_id: 'oidc-client',
        client_secret: 'oidc-secret',
        /**
         * This controls what authentication flows are this client supported.
         */
        grant_types: ['authorization_code'],
        /**
         * This settings controls what OpenID Connect authentication flows does
         * the client supports.
         *
         * https://openid.net/specs/openid-connect-core-1_0.html#Authentication
         */
        response_types: ['code'],
        /**
         * The default auth method 'client_secret_basic' is not 100% basic http
         * auth, the username and password tokens are supposed to be additionally
         * formencoded.
         *
         * Use POST request to avoid the hassle.
         */
        token_endpoint_auth_method: 'client_secret_post',
        /**
         * The first step in OpenID authentication with federated provider will
         * involve redirecting the user to their OpenID provider.
         *
         * After authenticating, the OpenID provider will redirect the user back
         * to this application at `/callback` URL.
         *
         * NOTE: We allow wildcard redirect uri, see below.
         */
        redirect_uris: [`${options.publicURL}/oidc/callback`],
      },
      {
        client_id: 'oidc-client-implicit',
        client_secret: 'oidc-secret',
        grant_types: ['authorization_code', 'refresh_token', 'implicit'],
        response_types: [
          'code', // Authorization Code Flow
          'id_token', //       Implicit Flow
          'code id_token', //    Hybrid Flow
        ],
        token_endpoint_auth_method: 'client_secret_post',
        /**
         * This client supports Implicit Flow that insecurel redirect URIs are
         * not allowed.
         */
        redirect_uris: [`${options.publicURL}/oidc/callback`],
      },
    ],
    routes: {
      authorization: `${routes.basePath}/auth`,
      backchannel_authentication: `${routes.basePath}/backchannel`,
      code_verification: `${routes.basePath}/device`,
      device_authorization: `${routes.basePath}/device/auth`,
      end_session: `${routes.basePath}/session/end`,
      introspection: `${routes.basePath}/token/introspection`,
      jwks: `${routes.basePath}/jwks`,
      pushed_authorization_request: `${routes.basePath}/request`,
      registration: `${routes.basePath}/reg`,
      revocation: `${routes.basePath}/token/revocation`,
      token: `${routes.basePath}/token`,
      userinfo: `${routes.basePath}/me`,
    },
    /**
     * https://github.com/panva/node-oidc-provider/tree/main/docs#user-flows
     * https://github.com/panva/node-oidc-provider/tree/main/docs#interactionsurl
     */
    interactions: {
      url: (_ctx, interaction) => `${routes.basePath}/interaction/${interaction.uid}`,
    },
    /**
     * Used to keep track of various User-Agent states.
     *
     * https://github.com/pillarjs/cookies#cookiesset-name--value---options--
     */
    cookies: {
      keys: ['1jPTI5IOrsdwiPofgtRp', 'R50Gs4rMjGOw0XpToJNt', '6HXOYMtWaobmA3igs9VY'],
      /**
       * Long-term cookie persists information of the authenticated user, which
       * is set after `interactionFinished`.
       *
       * The session cookies will be sent along with consecutive authentication
       * requests to skip login prompt for authenticated users. Otherwise, user
       * needs to invoke the "end_session_endpoint" to clear the cookies.
       *
       * We do want to establish new connection on every authentication request,
       * therefore we essentially throw away the session cookie.
       *
       * FIXME: Is there any better solution? How about `post_logout_redirect_uri`?
       */
      long: { signed: true, path: '/dev/null' },
    },
    /**
     * Loosen the restriction when acting as federated provider.
     *
     * https://github.com/panva/node-oidc-provider/tree/main/docs#pkce
     */
    pkce: {
      methods: ['S256'],
      required: () => false,
    },
    /**
     * Requesting Claims using Scope Values (Core 1.0) defines that claims requested
     * using the scope parameter are only returned from the UserInfo Endpoint unless
     * the response_type is id_token.
     *
     * Violate the best practice here to enable scope-requested claims in ID Tokens
     * to match the default behavior as in Auth0.
     *
     * https://openid.net/specs/openid-connect-core-1_0.html#ScopeClaims
     * https://github.com/panva/node-oidc-provider/tree/main/docs#conformidtokenclaims
     * https://github.com/panva/node-oidc-provider/tree/main/docs#id-token-does-not-include-claims-other-than-subl
     */
    conformIdTokenClaims: false, // default to true
    /**
     * Describes the claims that the OpenID Provider MAY be able to supply values
     * for. Normally it is a subset of the OpenID Connect 1.0 Standard Claims.
     *
     *    { "scope" -> [claims] }
     *
     * https://github.com/panva/node-oidc-provider/tree/main/docs#claims
     * https://github.com/panva/node-oidc-provider/blob/main/recipes/claim_configuration.md
     */
    claims: {
      address: ['address'],
      email: ['email', 'email_verified'],
      phone: ['phone_number', 'phone_number_verified'],
      profile: [
        'birthdate',
        'gender',
        'locale',
        'family_name',
        'middle_name',
        'given_name',
        'name',
        'nickname',
        'picture',
        'preferred_username',
        'profile',
        'updated_at',
        'website',
        'zoneinfo',
      ],
    },
    features: {
      devInteractions: { enabled: false }, // dev interation screens
      deviceFlow: { enabled: true }, // defaults to false
      revocation: { enabled: true }, // defaults to false
    },
    /**
     * This function will be called after the authentication request has succeeded
     * along with the OIDC scope and the subject's `accountId` from given result of
     * either `interactionResult` or `interactionFinished`.
     *
     * https://github.com/panva/node-oidc-provider/blob/main/docs/README.md#accounts
     */
    findAccount: async (_ctx, sub) => ({
      accountId: sub,
      claims: async (use, scope) => {
        const { logger } = options;
        logger.info('Generate user profile for subject', { sub, use, scope });

        const chance = new Chance(sub);
        const email = {
          email: chance.email(),
          email_verified: chance.bool(),
        };
        const phone = {
          phone_number: chance.phone(),
          phone_verified: chance.bool(),
        };
        const address = {
          locality: chance.city(),
          region: chance.state(),
          country: chance.country(),
          postal_code: chance.zip(),
          street_address: chance.address({ short_suffix: true }),
        };
        const person = {
          family_name: chance.last(),
          middle_name: chance.first(),
          given_name: chance.first(),
        };
        const profile = {
          ...person,
          name: `${person.given_name} ${person.middle_name} ${person.family_name}`,
          nickname: chance.animal(),
          birthday: chance.birthday().toISOString().split('T')[0],
          zoneinfo: chance.timezone().utc[0],
          gender: chance.gender(),
          locale: chance.locale({ region: true }),
          picture: chance.avatar({ protocol: 'https' }),
          website: chance.url(),
          profile: chance.url(),
          updated_at: chance.timestamp(),
        };
        return { sub, address, ...email, ...phone, ...profile };
      },
    }),
  });

  /**
   * HACK Allow wildcard redirect uri for development.
   *
   * Do not use this in production because it violates both the OpenID Connect spec
   * and OAuth 2.0 Security Best Current Practice.
   *
   * The proper alternative is Dynamic Client Registration (RFC 7591).
   *
   * https://github.com/panva/node-oidc-provider/blob/main/recipes/redirect_uri_wildcards.md
   * https://openid.net/specs/openid-connect-registration-1_0.html
   * https://datatracker.ietf.org/doc/html/rfc7591
   */
  provider.Client.prototype.redirectUriAllowed = _redirectUri => true;

  function handleClientAuthErrors(ctx: KoaContextWithOIDC, err: errors.OIDCProviderError) {
    const { logger } = options;
    const { authorization } = ctx.headers;
    const { client, body, params } = ctx.oidc;
    if (err.statusCode === 401 && err.message === 'invalid_client') {
      const error = err.message;
      logger.error(`[ClientAuthError]`, { authorization, body, client, error });
    } else {
      const error = err.message;
      logger.error(`[ClientError]`, { authorization, client, body, params, error });
    }
  }
  provider.on('jwks.error', handleClientAuthErrors);
  provider.on('grant.error', handleClientAuthErrors);
  provider.on('revocation.error', handleClientAuthErrors);
  provider.on('introspection.error', handleClientAuthErrors);
  provider.on('authorization.error', handleClientAuthErrors);
  provider.on('pushed_authorization_request.error', handleClientAuthErrors);
  provider.on('server_error', handleClientAuthErrors);

  // Trusting TLS offloading proxies
  provider.proxy = true;

  return provider;
};

/**
 * OpenID Connect Provider that handles an Authentication Request.
 *
 * https://openid.net/specs/openid-connect-core-1_0.html#AuthRequest
 * https://github.com/panva/node-oidc-provider/tree/main/docs
 * https://github.com/panva/node-oidc-provider/blob/main/docs/README.md#user-flows
 */
export const buildOIDCProvider = makeHandlers(() => [
  makeHandler({
    route: '/interaction/:uid',
    input: {
      params: t.type({ uid: t.union([t.string, t.undefined]) }),
    },
    context: t.type({ provider: instanceOf(Provider) }),
    middlewares: [middlewares.setNoCache],
    handle: async (_1, _2, { req, res, logger, provider }) => {
      const { prompt, uid, session } = await provider.interactionDetails(req, res);
      logger.info('Received interaction request', { prompt, uid, session });

      if (prompt.name === 'login') {
        const reply_to = `${provider.issuer}${routes.basePath}/interaction/${uid}/submit`;
        const query = new URLSearchParams({ ...prompt.details, reply_to });
        res.writeHead(302, { Location: '/oidc/interaction?' + query.toString() });
        return;
      }
      throw new Error(`Unsupported prompt: ${prompt.name}`);
    },
  }),
  makeHandler({
    route: '/interaction/:uid/submit',
    input: {
      params: t.type({ uid: t.union([t.string, t.undefined]) }),
      query: t.type({ code: t.union([t.string, t.undefined]) }),
    },
    context: t.type({ provider: instanceOf(Provider) }),
    middlewares: [middlewares.setNoCache],
    handle: async (_1, { code }, { req, res, logger, provider }) => {
      const { uid, params, grantId } = await provider.interactionDetails(req, res);
      const { client_id, scope } = params;

      if (typeof code !== 'string') {
        throw new Error('Invalid submission payload, "code" is required');
      }
      logger.info('Received interaction submission', { uid, params, grantId, code });

      // The program suppose to find the user from database with the provided
      // credentials, we will generate claims from the input code instead.
      //
      // TODO Generate hash as accountId with PBE instead
      const accountId = code;

      // Instead of redirecting user to a consent screen, we silently skip the
      // check by instantiating a grant without asking confirmation. rude!
      const grant = grantId
        ? await provider.Grant.find(grantId)
        : new provider.Grant({ accountId, clientId: client_id as string });

      if (grant === undefined) {
        throw new Error(`No grant found with ID: ${grantId}`);
      }
      if (!grant.getOIDCScope().includes(scope as string)) {
        grant.addOIDCScope(scope as string);
      }

      const result: InteractionResults = {
        login: { accountId, remember: false },
        consent: { grantId: await grant.save() },
      };

      // Resume uri is returned instead of immediate http redirect
      // @see provider.interactionFinished
      const redirectTo = await provider.interactionResult(req, res, result, {
        mergeWithLastSubmission: false,
      });
      logger.info(`Interaction finished, redirect user to ${redirectTo}`);
      res.writeHead(302, { Location: redirectTo });
    },
  }),
  makeHandler({
    route: '/.well-known/openid-configuration',
    context: t.type({ provider: instanceOf(Provider) }),
    handle: (_1, _2, { req, res, logger, provider }) => {
      logger.debug(`Received OIDC discovery request from ${req.url}`);
      req.url = req.url?.replace(/^\/api/, ''); // rewrite
      return provider.callback()(req, res);
    },
  }),
  makeHandler({
    route: '/:path*',
    context: t.type({ provider: instanceOf(Provider) }),
    handle: async (_1, _2, { req, res, logger, provider }) => {
      console.info('--- handle', req.url);
      req.url = req.url?.replace(/^\/api/, routes.basePath); // rewrite
      // req.url = req.url?.replace(/^\/api/, ''); // rewrite
      // req.url = req.url?.replace(/^\/oidc/, ''); // rewrite
      logger.debug(`Delegate request to OIDC provider: ${req.url}`);
      await Promise.resolve().then(() => provider.callback()(req, res));
    },
  }),
]);
