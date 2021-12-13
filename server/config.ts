import * as t from 'io-ts';
import { validate } from '@navch/codec';
import { BaseConfig, Option } from '@navch/common';

import { resolvePublicURL } from './utils';
import { Metadata } from './handlers/client';

export class AppConfig extends BaseConfig {
  readonly port = this.readNumber('PORT', 3000);

  readonly redisURI = this.read('REDIS_URI', null);

  readonly publicURL = Option.of(this.read('OIDC_PUBLIC_URL', null))
    .orElse(() => Option.of(this.read('VERCEL_URL', null)).map(domain => `https://${domain}`))
    .map(resolvePublicURL)
    .getOrElse(Promise.resolve(`http://localhost:${this.port}`));

  readonly oidcClients = Option.of(this.read('OIDC_CLIENTS', null))
    .map(JSON.parse)
    .map(data => validate(data, t.array(Metadata.codec)))
    .getOrElse([]);
}
