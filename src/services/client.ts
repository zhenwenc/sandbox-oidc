import * as R from 'ramda';
import { stringifyUrl } from 'query-string';
import { useMemo, useState } from 'react';
import { useAsyncFn, useMount, useMountedState, useLocalStorage } from 'react-use';
import { useLatestCallback } from '@navch-ui/hooks';
import { thread } from '@navch/common';

export type ClientInfo = {
  issuer: string;
  client_id: string;
  remote?: boolean;
};

export type ClientDetails = {
  issuer: string;
  client_id: string;
  client_secret: string;
};

export type ClientAuthParams = {
  enabled?: boolean;
  login_hint?: string;
};

async function registerClient(input: ClientDetails): Promise<unknown> {
  try {
    const resp = await fetch('/oauth/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!resp.ok) {
      throw new Error('Failed to register client');
    }
    return await resp.json();
  } catch (err) {
    console.error('Failed to register client', { input, err });
    throw err;
  }
}

async function fetchStaticClients(): Promise<ClientInfo[]> {
  try {
    const resp = await fetch('/oauth/clients', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return await resp.json();
  } catch (err) {
    console.error('Failed to fetch registered clients', { err });
    throw err;
  }
}

export function useOAuthClient() {
  const [storedClients = [], setStoredClients] = useLocalStorage<ClientDetails[]>('oidc:sandbox:clients');
  const [storedParams, setStoredParams] = useLocalStorage<ClientAuthParams>('oidc:sandbox:client-params');
  const [fetchedStaticClients, doFetchStaticClients] = useAsyncFn(fetchStaticClients);
  const [redirectUri, setRedirectUri] = useState('');

  const isMounted = useMountedState();
  const { value: remoteClients = [] } = fetchedStaticClients;

  const isSameClient = (a: ClientInfo) => (b: ClientInfo) => {
    return R.equals([a.issuer, a.client_id], [b.issuer, b.client_id]);
  };

  // Fetch data on client-side only
  useMount(async () => {
    setRedirectUri(`${window.location.origin}/oauth/callback`);
    await doFetchStaticClients();
  });

  return {
    redirectUri,
    /**
     * List all of the known OIDC clients.
     */
    clients: useMemo(() => {
      if (!isMounted()) return []; // Avoid mismatching react dom
      return [
        ...remoteClients.map(x => ({ ...x, remote: true })),
        ...storedClients.map(x => ({ ...x, remote: false })),
      ];
    }, [isMounted(), remoteClients, storedClients]),
    /**
     * Persist the given OIDC client into local storage. Existing client with the
     * same client `domain` and `client_id` will be replaced.
     *
     * This function does NOT register the client in backend server.
     */
    setClient: useLatestCallback(({ issuer, client_id, client_secret }: ClientDetails) => {
      const updated = thread(
        storedClients,
        R.reject(isSameClient({ issuer, client_id })),
        R.concat([{ issuer, client_id, client_secret }])
      );
      setStoredClients(updated);
    }),
    /**
     * Remove given OIDC client from local storage.
     *
     * This function does NOT sync the changes to backend server.
     */
    removeClient: useLatestCallback((client: ClientInfo) => {
      const updated = thread(storedClients, R.reject(isSameClient(client)));
      setStoredClients(updated);
    }),
    /**
     * Returns the stored custom authentication request params in browser storage.
     */
    getAuthParams: useLatestCallback(() => {
      return { isReady: isMounted(), ...storedParams };
    }),
    /**
     * Updates the custom authentication request params to have persisted values
     * across consecutive redirects.
     */
    setAuthParams: useLatestCallback((updates: Partial<ClientAuthParams>) => {
      if (!isMounted()) return;
      setStoredParams({ ...storedParams, ...updates });
    }),
    /**
     * Initiate authentication requests using configurations for the given client.
     *
     * This function also registers the client in backend server in order to
     * exchange access tokens when succeed.
     */
    authorize: useLatestCallback(async ({ issuer, client_id }: ClientInfo) => {
      const { enabled, ...params } = storedParams || {};

      const storedClient = storedClients.find(isSameClient({ issuer, client_id }));
      if (storedClient) {
        await registerClient(storedClient);
      }

      const client = storedClient ?? remoteClients.find(a => a.client_id === client_id);
      if (!client) {
        throw new Error(`No client found for id: ${client_id}`);
      }

      window.location.href = stringifyUrl({
        url: `${window.location.origin}/oauth/authorize`,
        query: { ...(enabled ? params : {}), client_id, redirect_uri: redirectUri },
      });
    }),
  };
}
