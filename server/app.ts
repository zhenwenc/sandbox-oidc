import * as t from 'io-ts';
import fs from 'fs';
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

// Load environment variables from .env* files. It will not modify any
// environment variables that have already been set.
// https://github.com/motdotla/dotenv
const dotenvFiles = ['.env.local', '.env'];
dotenvFiles.forEach(dotenvFile => {
  if (fs.existsSync(dotenvFile)) {
    require('dotenv').config({ path: dotenvFile });
  }
});

const port = process.env.PORT || '3000';

const logger = new Logger({
  name: 'oidc',
  prettyPrint: process.env.NODE_ENV !== 'production',
});
const requestLogger = morgan('dev', {
  stream: { write: compose(logger.debug, trim) },
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

const app = express();
app.enable('trust proxy'); // Trusting TLS offloading proxies

app.use(errorhandler({ log: (err, msg) => logger.error(msg, err) }));
app.use(requestLogger);
app.use('/health', (_, res) => {
  res.status(200).send('Ok');
});

const contextHandler = setRequestContext(async () => {
  const publicURL = !process.env.OIDC_PUBLIC_URL
    ? `http://localhost:${port}`
    : await resolvePublicURL(process.env.OIDC_PUBLIC_URL);
  return { publicURL, logger };
});
app.use(contextHandler);

app.use(buildOIDCProvider({ adapter }));
app.use(buildOIDCClient({ storage, clients }));

(async function bootstrap() {
  try {
    const web = next({ dev: process.env.NODE_ENV !== 'production' });
    await web.prepare();

    // Serve the static HTML if possible, fallback to development build
    // const dist = path.resolve(`${__dirname}/../dist`);
    // app.use(express.static(dist, { redirect: false, extensions: ['html'] }));

    const webHandler = web.getRequestHandler();
    app.all('*', (req, res) => webHandler(req, res));

    const server = app.listen(port, () => {
      logger.info(`Server listening at ${JSON.stringify(server.address())}`);
    });
  } catch (err) {
    console.error('Failed to launch server', err);
    process.exit(1);
  }
})();
