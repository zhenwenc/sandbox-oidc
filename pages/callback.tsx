import { parse } from 'query-string';
import { isEmpty } from 'ramda';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Message } from '@navch-ui/core';

import { Layout } from '@components/Layout';
import { InteractionResult } from '@components/InteractionResult';

export default function CallbackScreen() {
  const router = useRouter();
  const url = router.asPath;
  const query = url.includes('?') || !url.includes('#') ? router.query : parse(url.split('#', 2)[1]);

  const [params, setParams] = useState<Record<string, string>>();
  useEffect(() => {
    console.debug('[CallbackScreen] Parsed params:', query);

    // The page may not be able to read the browser's location when exported as
    // static HTML, or unexpectedly rendered on the server-side.
    if (isEmpty(query)) return;

    // If the page was opened in a popup window or iframe, let's communicate via
    // event messages to workaround the same-origin policy.
    //
    // Assuming the opener will be responsible to close the window on their own
    // that we won't consume the authorization code.
    //
    // https://stackoverflow.com/questions/25098021
    // https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
    if (window.opener) {
      window.opener.postMessage({ source: 'oidc-sandbox', payload: query }, '*');
    } else {
      setParams(query as Record<string, string>);
    }
  }, [JSON.stringify(query)]);

  return (
    <Layout noHeader={false}>
      {params ? (
        <InteractionResult params={params} showDetails={true} />
      ) : (
        <Message filled variant="loading">
          <Message.Title>{'Loading...'}</Message.Title>
        </Message>
      )}
    </Layout>
  );
}
