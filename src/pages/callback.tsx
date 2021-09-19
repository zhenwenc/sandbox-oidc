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

    if (isEmpty(query)) return;
    setParams(query as Record<string, string>);
  }, [JSON.stringify(query)]);

  return (
    <Layout noHeader={false}>
      {params ? (
        <InteractionResult params={params} showDetails={true} />
      ) : (
        <Message filled kind="loading" title="Loading..." />
      )}
    </Layout>
  );
}
