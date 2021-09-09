/**
 * https://github.com/panva/node-oidc-provider/blob/main/docs/README.md#adapter
 * https://github.com/panva/node-oidc-provider/blob/main/example/my_adapter.js
 * https://github.com/panva/node-oidc-provider/blob/main/example/adapters/redis.js
 */

import Redis from 'ioredis';
import { isEmpty } from 'ramda';
import { Adapter, AdapterFactory, AdapterPayload } from 'oidc-provider';

const grantable = new Set([
  'AccessToken',
  'AuthorizationCode',
  'RefreshToken',
  'DeviceCode',
  'BackchannelAuthenticationRequest',
]);

const consumable = new Set([
  'AuthorizationCode',
  'RefreshToken',
  'DeviceCode',
  'BackchannelAuthenticationRequest',
]);

function grantKeyFor(id: string) {
  return `grant:${id}`;
}

function userCodeKeyFor(userCode: string) {
  return `userCode:${userCode}`;
}

function uidKeyFor(uid: string) {
  return `uid:${uid}`;
}

export type RedisAdapterOptions = {
  readonly name: string;
  readonly client: Redis.Redis;
};
class RedisAdapter implements Adapter {
  readonly name: string;
  readonly client: Redis.Redis;

  readonly key = (id: string) => `${this.name}:${id}`;

  constructor(options: RedisAdapterOptions) {
    this.name = options.name;
    this.client = options.client;
  }

  async upsert(id: string, payload: AdapterPayload, expiresIn: number) {
    const key = this.key(id);

    const multi = this.client.multi();
    consumable.has(this.name)
      ? multi.hmset(key, { payload: JSON.stringify(payload) })
      : multi.set(key, JSON.stringify(payload));

    if (expiresIn) {
      multi.expire(key, expiresIn);
    }

    if (grantable.has(this.name) && payload.grantId) {
      const grantKey = grantKeyFor(payload.grantId);
      multi.rpush(grantKey, key);
      // if you're seeing grant key lists growing out of acceptable proportions consider using LTRIM
      // here to trim the list to an appropriate length
      const ttl = await this.client.ttl(grantKey);
      if (expiresIn > ttl) {
        multi.expire(grantKey, expiresIn);
      }
    }

    if (payload.userCode) {
      const userCodeKey = userCodeKeyFor(payload.userCode);
      multi.set(userCodeKey, id);
      multi.expire(userCodeKey, expiresIn);
    }

    if (payload.uid) {
      const uidKey = uidKeyFor(payload.uid);
      multi.set(uidKey, id);
      multi.expire(uidKey, expiresIn);
    }

    await multi.exec();
  }

  /**
   * Return previously stored instance of an oidc-provider model.
   *
   * @param {string} id Identifier of oidc-provider model
   * @return {Promise} Promise fulfilled with what was previously stored for the id (when found and
   * not dropped yet due to expiration) or falsy value when not found anymore. Rejected with error
   * when encountered.
   */
  async find(id: string): Promise<AdapterPayload | undefined> {
    const data = consumable.has(this.name)
      ? await this.client.hgetall(this.key(id))
      : await this.client.get(this.key(id));

    if (data === null || isEmpty(data)) {
      return undefined;
    }

    if (typeof data === 'string') {
      return JSON.parse(data);
    }
    const { payload, ...rest } = data;
    return { ...rest, ...JSON.parse(payload) };
  }

  /**
   * Return previously stored instance of Session by its uid reference property.
   *
   * @param {string} uid the uid value associated with a Session instance
   * @return {Promise} Promise fulfilled with the stored session object (when found and not
   * dropped yet due to expiration) or falsy value when not found anymore. Rejected with error
   * when encountered.
   */
  async findByUid(uid: string): Promise<AdapterPayload | undefined> {
    const id = await this.client.get(uidKeyFor(uid));
    return id === null ? undefined : this.find(id);
  }

  /**
   * Return previously stored instance of DeviceCode by the end-user entered user code. You only
   * need this method for the deviceFlow feature
   *
   * @param {string} userCode the user_code value associated with a DeviceCode instance
   * @return {Promise} Promise fulfilled with the stored device code object (when found and not
   * dropped yet due to expiration) or falsy value when not found anymore. Rejected with error
   * when encountered.
   */
  async findByUserCode(userCode: string): Promise<AdapterPayload | undefined> {
    const id = await this.client.get(userCodeKeyFor(userCode));
    return id === null ? undefined : this.find(id);
  }

  /**
   * Destroy/Drop/Remove a stored oidc-provider model. Future finds for this id should be fulfilled
   * with falsy values.
   *
   * @param {string} id Identifier of oidc-provider model
   * @return {Promise} Promise fulfilled when the operation succeeded. Rejected with error when
   * encountered.
   */
  async destroy(id: string): Promise<undefined | void> {
    const key = this.key(id);
    await this.client.del(key);
  }

  /**
   * Destroy/Drop/Remove a stored oidc-provider model by its grantId property reference. Future
   * finds for all tokens having this grantId value should be fulfilled with falsy values.
   *
   * @param {string} grantId the grantId value associated with a this model's instance
   * @return {Promise} Promise fulfilled when the operation succeeded. Rejected with error when
   * encountered.
   */
  async revokeByGrantId(grantId: string): Promise<undefined | void> {
    const multi = this.client.multi();
    const tokens = await this.client.lrange(grantKeyFor(grantId), 0, -1);
    tokens.forEach(token => multi.del(token));
    multi.del(grantKeyFor(grantId));
    await multi.exec();
  }

  /**
   * Mark a stored oidc-provider model as consumed (not yet expired though!). Future finds for this
   * id should be fulfilled with an object containing additional property named "consumed" with a
   * truthy value (timestamp, date, boolean, etc).
   *
   * @param {string} id Identifier of oidc-provider model
   * @return {Promise} Promise fulfilled when the operation succeeded. Rejected with error when
   * encountered.
   */
  async consume(id: string): Promise<undefined | void> {
    await this.client.hset(this.key(id), 'consumed', Math.floor(Date.now() / 1000));
  }
}

export function buildRedisAdapterFactory(client: Redis.Redis): AdapterFactory {
  return function buildRedisAdapter(name: string) {
    return new RedisAdapter({ name, client });
  };
}
