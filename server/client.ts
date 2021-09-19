import * as t from 'io-ts';
import R from 'ramda';
import express from 'express';
import memoize from 'memoizee';
import { BinaryLike, createHash, randomBytes } from 'crypto';
import { Issuer, AuthorizationParameters, custom, errors } from 'openid-client';

import { ForbiddenError, NotFoundError, isNotNullish, threadP } from '@navch/common';
import { makeHandler, makeRouter } from '@navch/express';
import { validate } from '@navch/codec';

import { Storage } from './storage';

export type Metadata = t.TypeOf<typeof Metadata.codec>;
export namespace Metadata {
  export const withClientId = (clientId: string) => `oidc:register:${clientId}`;
  export const withVerifier = (verifier: string) => `oidc:verifier:${verifier}`;
  export const codec = t.type({
    /**
     * A valid absolute OpenID issuer URL for this Relying Party.
     */
    issuer: t.string,
    /**
     * A valid Client ID to be used for Authorization Request.
     */
    client_id: t.string,
    /**
     * The matched Client Secret to be used for the client.
     */
    client_secret: t.string,
    /**
     * An registered Redirection URI to be used for the Authorization request at
     * the OIDC Provider.
     */
    redirect_uri: t.union([t.string, t.undefined]),
    /**
     * If a nonce value was sent in the Authentication Request, a nonce Claim must
     * be present and its value checked to verify that it is the same value as the
     * one that was sent in the Authentication Request to prevent replay attacks.
     */
    nonce: t.union([t.string, t.undefined]),
  });
}

export type ClientContext = t.TypeOf<typeof ClientContext.codec>;
export namespace ClientContext {
  export const codec = t.type({ publicURL: t.string });
}

export type OIDCClientOptions = {
  readonly storage: Storage;
  readonly clients: Partial<Metadata>[] | undefined;
};

/**
 * A general-purpose OpenID Connect Relying Party WebApp for request orchestration.
 *
 * - Generate authorization requests with proper parameters.
 * - Default callback handler for response inspection.
 * - Dynamic OAuth client registration to support custom OIDC provider.
 *
 * http://localhost:8080/oauth
 * https://sandbox-oidc.herokuapp.com/oauth
 */
export const buildOIDCClient = makeRouter<OIDCClientOptions>(options => {
  const discover = memoize(Issuer.discover, { async: true, max: 10, maxAge: 5000 });

  // We hosts the Provider in a sub-path, it may require redirect during discovery.
  custom.setHttpOptionsDefaults({ followRedirect: true });

  const withContext = (publicURL: string) => {
    const defaultClient: Required<Metadata> = {
      issuer: publicURL,
      client_id: 'oidc-client',
      client_secret: 'oidc-secret',
      redirect_uri: `${publicURL}/oauth/callback`,
      nonce: undefined,
    };

    const getMetadata = async (key: string | undefined): Promise<Metadata | undefined> => {
      if (typeof key !== 'string') return undefined;

      const registered = await options.storage.getItem(key);
      if (registered) {
        return validate(registered, Metadata.codec);
      }

      const predefined = options.clients?.find(({ client_id }) => {
        return client_id && Metadata.withClientId(client_id) === key;
      });
      if (predefined) {
        return validate(predefined, Metadata.codec);
      }
      return Metadata.withClientId(defaultClient.client_id) ? defaultClient : undefined;
    };

    return { defaultClient, getMetadata };
  };

  return [
    makeHandler({
      route: '/oauth/clients',
      method: 'GET',
      context: ClientContext.codec,
      handle: async (_1, _2, { res, logger, publicURL }) => {
        logger.debug('Return predefined OIDC clients');

        const service = withContext(publicURL);
        const results = await threadP(
          [service.defaultClient, ...(options.clients || [])],
          R.map(x => Metadata.withClientId(validate(x.client_id, t.string))),
          R.pipe(R.map(service.getMetadata), s => Promise.all(s)),
          R.filter(isNotNullish),
          R.map(R.pick(['issuer', 'client_id', 'redirect_uri']))
        );
        res.send(results);
      },
    }),
    makeHandler({
      route: '/oauth/clients',
      method: 'POST',
      context: ClientContext.codec,
      input: { body: Metadata.codec },
      handle: async (_1, args, { res, logger, publicURL }) => {
        const service = withContext(publicURL);
        const { client_id, redirect_uri = service.defaultClient.redirect_uri } = args;
        const metadata = { ...args, redirect_uri };
        logger.info('Register OIDC verifier with settings', metadata);

        if (service.defaultClient.client_id === client_id) {
          throw new ForbiddenError({ reason: 'Default OIDC clients is protected!' });
        }
        if (options.clients?.some(x => x.client_id === client_id)) {
          throw new ForbiddenError({ reason: 'Predefined clients are protected!' });
        }
        await options.storage.setItem(Metadata.withClientId(client_id), metadata, 86400);
        res.send({ status: 'Ok' });
      },
    }),
    makeHandler({
      route: '/oauth/authorize',
      middlewares: [express.urlencoded({ extended: false })],
      context: ClientContext.codec,
      input: {
        query: t.type({
          /**
           * Identifier of a preregistered client in the OIDC Provider to be used
           * for the Authorization request.
           */
          client_id: t.union([t.string, t.undefined]),
          /**
           * An OAuth 2.0 Response Type value that determines the authorization
           * processing flow to be used. Default to Authorization Code Flow.
           */
          response_type: t.union([t.string, t.undefined]),
          /**
           * Determine how the authorization response should be returned.
           *
           * - `query`:       302 Found triggers redirect. For Authorization Code grant.
           * - `fragment`:    302 Found triggers redirect. For Implicit grant.
           * - `form_post`:   200 OK with response parameters embedded in an HTML
           *                  form as hidden parameters.
           * - `web_message`: Uses HTML5 web messaging. For Silent Authentication.
           */
          response_mode: t.union([t.string, t.undefined]),
          /**
           * Callback location where the authorization code or tokens for implicit
           * and hybrid flows should be sent. It must match the value preregistered
           * in the OIDC Provider during client registration
           */
          redirect_uri: t.union([t.string, t.undefined]),
          /**
           * An optional preferred languages and scripts for the user interface,
           * represented as a space-separated list of BCP47 [RFC5646] language tag
           * values, ordered by preference.
           */
          ui_locales: t.union([t.string, t.undefined]),
          /**
           * An optional value to prepopulate when prompting for authentication.
           */
          login_hint: t.union([t.string, t.undefined]),
        }),
      },
      handle: async (_1, args, { res, logger, publicURL }) => {
        logger.info('Generate authorization request with parameters', args);
        const { client_id, response_type, response_mode, redirect_uri, ...rest } = args;
        const service = withContext(publicURL);

        const state = base64URLEncode(randomBytes(32));
        const nonce = base64URLEncode(randomBytes(32));

        const verifier = base64URLEncode(Buffer.from(state));
        const challenge = base64URLEncode(sha256(verifier));

        const stored = await service.getMetadata(client_id && Metadata.withClientId(client_id));
        const metadata = {
          ...R.reject(R.isNil, service.defaultClient),
          ...R.reject(R.isNil, stored || {}),
          ...R.reject(R.isNil, { redirect_uri, nonce }),
        };

        const issuer = await discover(metadata.issuer);
        const client = new issuer.Client({ client_id: metadata.client_id });

        // Memorize the authentication metadata for token endpoint
        await options.storage.setItem(Metadata.withVerifier(verifier), metadata, 300);

        // OpenID Connect Authentication flows
        // https://openid.net/specs/openid-connect-core-1_0.html#Authentication
        const params: AuthorizationParameters = {
          prompt: 'login',
          /**
           * Request specific sets of information be made available as Claims in
           * the response of the userinfo endpoint.
           *
           * https://openid.net/specs/openid-connect-core-1_0.html#UserInfo
           */
          scope: 'openid profile email',
          /**
           * Determines the authorization processing flow to be used, including
           * what parameters are returned from the endpoints used.
           */
          response_type: response_type ?? 'code',
          /**
           * The default value for response_type=id_token is 'fragment', where
           * the OIDC provider will redirect the request with parameters hidden
           * behind a fragment identifier '#' that won't be sent to the server.
           *
           * Use 'form_post' to instruct the provider to POST the response data
           * to the callback endpoint when handling the callback at server-side.
           *
           * Use 'query' to override the default behaviour.
           *
           * https://github.com/panva/node-oidc-provider/issues/759
           */
          response_mode: response_mode ?? 'query',
          /**
           * Redirection URI to where the authorization response will be sent.
           */
          redirect_uri: metadata.redirect_uri,
          /**
           * A string value used to associate a Client session with an ID Token,
           * and to mitigate replay attacks. This is required for Implicit and
           * Hybrid flows, but optional for Authorization Code Flow.
           */
          nonce,
          /**
           * A value to be returned in the token. We use state to pairwise verifier
           * of the interaction with this authentication call, see notes below.
           */
          state,
          /**
           * A challenge for Proof Key for Code Exchange (PKCE). The challenge may
           * be verified in the access token request for native clients using code
           * or hybrid flows, which depends on the OIDC Provider configuration.
           *
           * https://tools.ietf.org/html/rfc7636
           */
          code_challenge: challenge,
          /**
           * Method used to derive the code challenge for PKCE.
           */
          code_challenge_method: 'S256',
          /**
           * Forward the optional auxiliary parameters if provided.
           */
          ...R.reject(R.isNil, rest),
        };

        logger.info('Generated authorization request', params);
        res.redirect(client.authorizationUrl(params));
      },
    }),
    makeHandler({
      route: '/oauth/token',
      method: 'POST',
      middlewares: [express.json()],
      context: ClientContext.codec,
      input: {
        body: t.type({
          /**
           * An opaque value used to maintain state between the request and the
           * callback. Typically, Cross-Site Request Forgery (CSRF, XSRF) mitigation
           * is done by cryptographically binding the value of this parameter with a
           * browser cookie.
           *
           * For stateless usage, we use this property to pairwise the `verifier`.
           */
          state: t.string,
          /**
           * Response from Authorization Code Flow.
           */
          code: t.string,
          /**
           * Response from Implicit Flow.
           */
          id_token: t.union([t.string, t.undefined]),
        }),
      },
      handle: async (_self, args, { logger, publicURL }) => {
        logger.info('Received token request with authorization code', args);
        const { state, code } = args;
        const service = withContext(publicURL);

        const verifier = base64URLEncode(Buffer.from(state));
        const metadata = await service.getMetadata(Metadata.withVerifier(verifier));
        if (!metadata) {
          throw new NotFoundError(`No OpenID metadata found for verifier: ${verifier}`);
        }

        const { client_id, client_secret, redirect_uri, nonce } = metadata;
        const issuer = await discover(metadata.issuer);
        const client = new issuer.Client({ client_id, client_secret });

        // Exchange access token with the received Authorization Code. This step
        // must perform on the server-side as it requires client credentials.
        //
        const exchangeToken = client.callback(
          redirect_uri ?? `${publicURL}/oauth/callback`,
          { code, state },
          { nonce, state, code_verifier: verifier }
        );
        const token = await exchangeToken.catch((err: errors.RPError) => {
          logger.error(`Failed to fetch token`, { code, verifier, error: err.message });
          throw err;
        });

        // Fetch all scoped claims from the UserInfo endpoint.
        //
        const userinfo = await client.userinfo(token).catch((err: errors.RPError) => {
          logger.error(`Failed to fetch user profile`, { token, error: err.message });
          return { error: err.message };
        });

        return { id_token: token.claims(), token: token, userinfo };
      },
    }),
    makeHandler({
      route: '/oauth/logout',
      context: ClientContext.codec,
      input: {
        query: t.type({
          /**
           * Identifier of a preregistered client in the OIDC Provider to be used
           * for the Authorization request.
           */
          client_id: t.union([t.string, t.undefined]),
        }),
      },
      handle: async (_self, { client_id }, { res, logger, publicURL }) => {
        const service = withContext(publicURL);
        const metadata = await service.getMetadata(client_id && Metadata.withClientId(client_id));
        if (!metadata) {
          throw new NotFoundError('No OpenID metadata found for Relying Party');
        }
        const issuer = await discover(metadata.issuer);
        const client = new issuer.Client({ client_id: metadata.client_id });

        logger.info('Received logout request, redirect to end_session_endpoint');
        res.redirect(client.endSessionUrl());
      },
    }),
  ];
});

function base64URLEncode(input: Buffer) {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function sha256(input: BinaryLike) {
  return createHash('sha256').update(input).digest();
}
