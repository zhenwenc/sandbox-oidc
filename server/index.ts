import fs from 'fs';
import Redis from 'ioredis';
import morgan from 'morgan';
import memoize from 'memoizee';
import { compose, trim } from 'ramda';

import { Logger } from '@navch/common';
import { makeRouter, middlewares, setRequestContext } from '@navch/express';

import { buildOIDCClient } from './handlers/client';
import { buildOIDCProvider, buildProvider } from './handlers/provider';
import { buildRedisAdapterFactory } from './adapter';
import { buildInMemoryStorage, buildRedisStorage } from './storage';
import { AppConfig } from './config';

// Load environment variables from .env* files. It will not modify any
// environment variables that have already been set.
// https://github.com/motdotla/dotenv
const dotenvFiles = ['.env.local', '.env'];
dotenvFiles.forEach(dotenvFile => {
  if (fs.existsSync(dotenvFile)) {
    require('dotenv').config({ path: dotenvFile });
  }
});

export function buildHandler() {
  const config = new AppConfig();
  const logger = new Logger({ name: 'oidc', prettyPrint: !config.isProdEnv });

  const requestLogger = morgan('dev', {
    stream: { write: compose(logger.debug, trim) },
  });

  const adapter = config.redisURI
    ? buildRedisAdapterFactory(
        new Redis(config.redisURI, {
          keyPrefix: 'stack:oidc:adapter:',
          showFriendlyErrorStack: true,
        })
      )
    : undefined;

  const storage = config.redisURI
    ? buildRedisStorage(
        new Redis(config.redisURI, {
          keyPrefix: 'stack:oidc:storage:',
          showFriendlyErrorStack: true,
        })
      )
    : buildInMemoryStorage();

  const buildProviderCached = memoize(buildProvider, {
    normalizer: ([{ publicURL }]) => publicURL,
    max: 10,
    maxAge: 30000,
  });

  const requestContext = setRequestContext(async () => {
    const publicURL = await config.publicURL;
    const provider = buildProviderCached({
      logger,
      adapter,
      publicURL,
    });
    return { logger, provider, publicURL };
  });

  const router = makeRouter();
  router.use(requestContext);
  router.use(middlewares.fromCallback(requestLogger));

  const clients = config.oidcClients;
  const clientRouter = makeRouter(buildOIDCClient({ storage, clients }));
  router.use('/api/clients', clientRouter.routes());

  const providerRouter = makeRouter(buildOIDCProvider());
  router.use('/api', providerRouter.routes());

  return router;
}
