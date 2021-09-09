import * as t from 'io-ts';
import next from 'next';
import morgan from 'morgan';
import express from 'express';
import errorhandler from 'errorhandler';
import Redis from 'ioredis';
import { compose, trim } from 'ramda';

import { Logger } from '@navch/common';
import { validate } from '@navch/codec';
import { setRequestContext } from '@navch/express';

import { buildOIDCClient, Metadata } from './client';
import { buildOIDCProvider } from './provider';
import { buildRedisAdapterFactory } from './adapter';
import { buildInMemoryStorage, buildRedisStorage } from './storage';
import { resolvePublicURL } from './utils';

async function bootstrap() {
  const expressLogger = new Logger({
    name: 'oidc',
    prettyPrint: process.env.NODE_ENV !== 'production',
  });
  const requestLogger = morgan('dev', {
    stream: { write: compose(expressLogger.debug, trim) },
    skip: ({ path, baseUrl }: express.Request) => {
      return !!path.match(/^\/_+next/) || !!baseUrl?.match(/^\/health/);
    },
  });

  const adapter = process.env.REDIS_URI
    ? buildRedisAdapterFactory(
        new Redis(process.env.REDIS_URI, {
          keyPrefix: 'stack:oidc:adapter:',
          showFriendlyErrorStack: true,
        })
      )
    : undefined;

  const storage = process.env.REDIS_URI
    ? buildRedisStorage(
        new Redis(process.env.REDIS_URI, {
          keyPrefix: 'stack:oidc:storage:',
          showFriendlyErrorStack: true,
        })
      )
    : buildInMemoryStorage();

  // Load predefined OIDC clients
  const clients = process.env.OIDC_CLIENTS
    ? validate(JSON.parse(process.env.OIDC_CLIENTS), t.array(Metadata.codec))
    : undefined;

  const web = next({
    conf: { basePath: '/oauth' } as any,
    dev: process.env.NODE_ENV !== 'production',
  });
  const webHandler = web.getRequestHandler();
  await web.prepare();

  const app = express();
  app.use(errorhandler({ log: (err, msg) => expressLogger.error(msg, err) }));
  app.use(requestLogger);
  app.use(setRequestContext({ logger: expressLogger }));
  app.use('/health', (_, res) => {
    res.status(200).send('Ok');
  });

  app.enable('trust proxy'); // Trusting TLS offloading proxies

  if (!process.env.OIDC_PUBLIC_URL) {
    throw new Error('Environment variable OIDC_PUBLIC_URL is required!');
  }
  const publicURL = await resolvePublicURL(process.env.OIDC_PUBLIC_URL);

  app.use(await buildOIDCProvider({ publicURL, adapter }));
  app.use(await buildOIDCClient({ publicURL, storage, clients }));

  // Serve the static HTML if possible, fallback to development build
  // const dist = path.resolve(`${__dirname}/../dist`);
  // app.use(express.static(dist, { redirect: false, extensions: ['html'] }));

  app.all('*', (req, res) => webHandler(req, res));

  const server = app.listen(process.env.PORT || 3000, () => {
    expressLogger.info(`Server listening at ${JSON.stringify(server.address())}`);
  });
}

bootstrap().catch(error => {
  console.error('Failed to launch server', error);
  process.exit(1);
});
