import { useAsyncFn } from 'react-use';
import { stringifyUrl } from 'query-string';

import { sleep } from '@navch/common';

function openPopup(url: string): Window {
  const w = 600;
  const h = 400;
  const left = screen.width / 2 - w / 2;
  const top = screen.height / 2 - h / 2;

  const features = {
    toolbar: 'no',
    location: 'no',
    directories: 'no',
    status: 'no',
    menubar: 'no',
    scrollbars: 'no',
    resizable: 'no',
    copyhistory: 'no',
    width: w,
    height: h,
    top: top,
    left: left,
  };
  const params = Object.entries(features)
    .map(([k, v]) => k + '=' + v)
    .join(',');
  return window.open(url, '', params)!;
}

function isPopupOpen(popup: Window): boolean {
  return popup && popup.closed !== undefined && !popup.closed;
}

function getAuthResult(popup: Window): Record<string, string> | null {
  try {
    const { hash, hostname, pathname, search } = popup.location;
    if (hostname !== '' && pathname.includes('/callback')) {
      if (search === '' && hash === '') {
        throw new Error(
          'OAuth redirect has occurred but no query or hash parameters ' +
            'were found. They were either not set during the redirect, or ' +
            'were removed—typically by a routing library.'
        );
      }

      const params = new URLSearchParams(search !== '' ? search : hash.substring(1));
      const code = params.get('code');
      const state = params.get('state');
      const error = params.get('error');
      const error_details = params.get('error_details');

      if (!code || !state) throw { error: 'Invalid authentication result' };
      if (error) throw { error, error_details };
      return { code, state };
    }
    return null;
  } catch (err) {
    // Ignore DOMException: Blocked a frame with origin from accessing
    // a cross-origin frame. A hack to get around same-origin security
    // policy errors in IE.
    if (err instanceof DOMException) return null;
    throw { error: err.message, error_details: JSON.stringify(err) };
  }
}

async function promptLogin() {
  const redirect_uri = `${window.location.origin}/callback`;

  const authorizeUrl = stringifyUrl({
    url: `${window.location.origin}/oauth/authorize`,
    query: { redirect_uri },
  });
  const popup = openPopup(authorizeUrl);

  try {
    while (isPopupOpen(popup)) {
      await sleep(500);
      const data = getAuthResult(popup);
      if (data) {
        return { redirect_uri, ...data };
      }
    }
    return undefined;
  } finally {
    popup.close();
  }
}

type UseInteractionWindowOptions = {};
export function useInteractionWindow(_: UseInteractionWindowOptions = {}) {
  return useAsyncFn(promptLogin);
}
