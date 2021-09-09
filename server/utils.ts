import * as t from 'io-ts';
import got, { HTTPError } from 'got';
import { URL } from 'url';

const NgrokResponse = t.type({ tunnels: t.array(t.type({ proto: t.string, public_url: t.string })) });

export async function resolvePublicURL(url: string): Promise<string> {
  const { href, protocol } = new URL(url);

  if (protocol === 'ngrok:') {
    const request = got(href.replace('ngrok:', 'http:')).json();
    const resp = await request.catch((err: HTTPError) => {
      const message = err.response?.body ?? err.message;
      throw new Error(`Failed to fetch Ngrok tunnel: ${message}`);
    });
    if (!NgrokResponse.is(resp)) {
      throw new Error(`Invalid Ngrok API response from ${url}`);
    }
    const tunnel = resp.tunnels.find(a => a.proto === 'https');
    if (!tunnel) {
      throw new Error(`Ngrok HTTPS tunnel is not available`);
    }
    return tunnel.public_url;
  }
  return href;
}
